import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import crypto from 'crypto';
import cors from 'cors';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 10000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized:false } });
const cfBase = process.env.CASHFREE_ENV === 'production' ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com';

app.use(cors({ origin: true }));
app.use(express.json({ verify:(req,res,buf)=>{ req.rawBody=buf.toString('utf8'); } }));

const money = n => Math.round(Number(n)*100)/100;
const safePhone = p => String(p||'').replace(/\D/g,'').slice(-10);

async function cf(pathname, options={}) {
  const r = await fetch(cfBase + pathname, {
    ...options,
    headers:{
      'x-client-id':(process.env.CASHFREE_CLIENT_ID || process.env.CASHFREE_APP_ID),
      'x-client-secret':process.env.CASHFREE_CLIENT_SECRET,
      'x-api-version':'2025-01-01',
      'Accept':'application/json','Content-Type':'application/json',
      ...(options.headers||{})
    }
  });
  const text = await r.text();
  let data; try { data=JSON.parse(text); } catch { data={raw:text}; }
  if(!r.ok) throw new Error(data.message || data.error || `Cashfree HTTP ${r.status}`);
  return data;
}

app.get('/api/health', async (req,res)=>{
  try { await pool.query('SELECT 1'); res.json({ok:true, paymentsConfigured:!!(process.env.CASHFREE_CLIENT_ID || process.env.CASHFREE_APP_ID)}); }
  catch(e){ res.status(503).json({ok:false,error:e.message}); }
});

app.post('/api/orders', async (req,res)=>{
  try {
    const {customer, address, items, amount} = req.body;
    if(!customer?.name || !safePhone(customer.phone) || !address?.line1 || !address?.city || !address?.state || !/^\d{6}$/.test(address.pincode)) return res.status(400).json({error:'Valid customer and delivery details are required.'});
    if(!Array.isArray(items)||!items.length) return res.status(400).json({error:'Cart is empty.'});
    const cleanItems=items.map(x=>({id:x.id,name:String(x.name),price:money(x.price),qty:Math.max(1,Math.min(99,Number(x.qty)||1)),image:String(x.image||''),variant:String(x.variant||'')}));
    const calculated=money(cleanItems.reduce((s,x)=>s+x.price*x.qty,0));
    if(money(amount)!==calculated) return res.status(400).json({error:'Order total mismatch. Please refresh cart and try again.'});
    const orderId='ZEVQORA_'+Date.now()+'_'+crypto.randomBytes(3).toString('hex').toUpperCase();
    await pool.query(`INSERT INTO orders(order_id,customer_name,customer_phone,customer_email,address,city,state,pincode,amount,items) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[orderId,customer.name,safePhone(customer.phone),customer.email||null,address.line1,address.city,address.state,address.pincode,calculated,JSON.stringify(cleanItems)]);
    const cfOrder=await cf('/pg/orders',{method:'POST',body:JSON.stringify({order_id:orderId,order_amount:calculated,order_currency:'INR',customer_details:{customer_id:safePhone(customer.phone),customer_name:customer.name,customer_email:customer.email||undefined,customer_phone:safePhone(customer.phone)},order_meta:{return_url:`${process.env.PUBLIC_BASE_URL}/?payment_return=1&order_id={order_id}`,notify_url:`${process.env.PUBLIC_BASE_URL}/api/cashfree/webhook`},order_note:'ZEVQORA online order'})});
    await pool.query(`UPDATE orders SET cashfree_payment_session_id=$1,updated_at=NOW() WHERE order_id=$2`,[cfOrder.payment_session_id,orderId]);
    res.json({orderId,paymentSessionId:cfOrder.payment_session_id,amount:calculated});
  } catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

app.get('/api/orders/:orderId', async (req,res)=>{
  const {rows}=await pool.query('SELECT order_id,customer_name,customer_phone,amount,currency,items,payment_status,order_status,awb_number,tracking_url,created_at,updated_at FROM orders WHERE order_id=$1',[req.params.orderId]);
  if(!rows[0]) return res.status(404).json({error:'Order not found'});
  res.json(rows[0]);
});

app.get('/api/orders', async (req,res)=>{
  const phone=safePhone(req.query.phone); if(phone.length!==10) return res.status(400).json({error:'Enter a valid mobile number.'});
  const {rows}=await pool.query('SELECT order_id,amount,payment_status,order_status,awb_number,tracking_url,created_at,items FROM orders WHERE customer_phone=$1 ORDER BY created_at DESC',[phone]);
  res.json(rows);
});

app.post('/api/orders/:orderId/status', async (req,res)=>{
  if(req.headers['x-admin-secret']!==process.env.ADMIN_SECRET) return res.status(401).json({error:'Unauthorized'});
  const {order_status,awb_number,tracking_url}=req.body;
  const allowed=['PAYMENT_PENDING','CONFIRMED','PACKED','SHIPPED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'];
  if(!allowed.includes(order_status)) return res.status(400).json({error:'Invalid status'});
  const {rows}=await pool.query('UPDATE orders SET order_status=$1,awb_number=COALESCE($2,awb_number),tracking_url=COALESCE($3,tracking_url),updated_at=NOW() WHERE order_id=$4 RETURNING order_id,order_status,awb_number,tracking_url',[order_status,awb_number||null,tracking_url||null,req.params.orderId]);
  if(!rows[0]) return res.status(404).json({error:'Order not found'}); res.json(rows[0]);
});

app.post('/api/cashfree/webhook', async (req,res)=>{
  try {
    const ts=req.headers['x-webhook-timestamp'], sig=req.headers['x-webhook-signature'];
    if(!ts||!sig||!req.rawBody) return res.status(400).send('Missing signature');
    const expected=crypto.createHmac('sha256',process.env.CASHFREE_CLIENT_SECRET).update(ts+req.rawBody).digest('base64');
    if(!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(sig))) return res.status(400).send('Invalid signature');
    const body=JSON.parse(req.rawBody); const orderId=body?.data?.order?.order_id || body?.data?.order?.order_id;
    const paymentStatus=body?.data?.payment?.payment_status;
    if(orderId){
      if(paymentStatus==='SUCCESS') await pool.query(`UPDATE orders SET payment_status='SUCCESS',order_status=CASE WHEN order_status='PAYMENT_PENDING' THEN 'CONFIRMED' ELSE order_status END,updated_at=NOW() WHERE order_id=$1`,[orderId]);
      else if(paymentStatus==='FAILED') await pool.query(`UPDATE orders SET payment_status='FAILED',updated_at=NOW() WHERE order_id=$1`,[orderId]);
    }
    res.sendStatus(200);
  } catch(e){ console.error(e); res.status(400).send('Webhook error'); }
});

app.get('/api/payment-status/:orderId', async (req,res)=>{
  try {
    const data=await cf(`/pg/orders/${encodeURIComponent(req.params.orderId)}/payments`,{method:'GET'});
    const success=data.some(x=>x.payment_status==='SUCCESS');
    if(success) await pool.query(`UPDATE orders SET payment_status='SUCCESS',order_status=CASE WHEN order_status='PAYMENT_PENDING' THEN 'CONFIRMED' ELSE order_status END,updated_at=NOW() WHERE order_id=$1`,[req.params.orderId]);
    res.json({payments:data,paid:success});
  } catch(e){res.status(500).json({error:e.message});}
});

app.listen(PORT,()=>console.log(`ZEVQORA server listening on ${PORT}`));
