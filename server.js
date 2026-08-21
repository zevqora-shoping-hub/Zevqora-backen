import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
const app=express();
app.use(cors({origin:process.env.FRONTEND_URL||'*'}));
app.use(express.json({limit:'1mb'}));

const categories=['Fashion',"Men's Fashion","Women's Fashion",'Kids','Electronics','Mobiles & Accessories','Computers & Laptops','Home & Kitchen','Furniture','Beauty & Personal Care','Grocery','Sports & Fitness','Footwear','Watches','Bags','Jewellery','Toys','Automotive','Books','Health & Wellness','Daily Essentials'];
const image='https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80';
const names=['Aero Wireless Headphones','Urban Everyday Sneakers','Nova Smart Watch','Minimal Desk Lamp','Everyday Backpack','Pulse Fitness Band','Classic Chronograph Watch','Luma Travel Bottle','Core Cotton Hoodie','Studio Bluetooth Speaker'];
const products=Array.from({length:100},(_,i)=>({id:i+1,name:`${names[i%names.length]} ${i+1}`,slug:`product-${i+1}`,description:'A carefully selected ZEVQORA product designed for everyday use, combining practical features with a premium finish.',category:categories[i%categories.length],subcategory:'Featured',brand:['ZEVQORA','Aero','Nova','Urban','Core'][i%5],price:499+(i%20)*250,original_price:899+(i%20)*400,discount_percentage:20+(i%5)*5,images:[image],rating:Number((4+(i%10)/10).toFixed(1)),review_count:20+i,stock:10+(i%40),SKU:`ZQ-${String(i+1).padStart(4,'0')}`,specifications:{Material:'Premium grade',Warranty:'6 months',Country:'India'},variants:{color:['Black','White','Silver'],size:['S','M','L','XL']},seller:'ZEVQORA Marketplace',warranty:'6 months',delivery_information:'Fast delivery available'}));

app.get('/api/health',(req,res)=>res.json({ok:true,service:'ZEVQORA API'}));
app.get('/api/products',(req,res)=>{let out=products;const {category,q}=req.query;if(category)out=out.filter(p=>p.category===category);if(q)out=out.filter(p=>(p.name+p.brand+p.category).toLowerCase().includes(String(q).toLowerCase()));res.json({products:out,total:out.length});});
app.get('/api/products/:id',(req,res)=>{const p=products.find(x=>x.id===Number(req.params.id));if(!p)return res.status(404).json({message:'Product not found'});res.json({product:p});});
app.get('/api/categories',(req,res)=>res.json({categories}));
app.get('/api/search',(req,res)=>{const q=String(req.query.q||'');const out=products.filter(p=>(p.name+' '+p.brand+' '+p.category).toLowerCase().includes(q.toLowerCase()));res.json({products:out});});

// Supabase and Cashfree are intentionally server-side integrations.
// Add credentials to .env before enabling these endpoints.
app.post('/api/payment/create-order',async(req,res)=>{if(!process.env.CASHFREE_APP_ID||!process.env.CASHFREE_SECRET_KEY)return res.status(503).json({message:'Cashfree is not configured. Add CASHFREE_APP_ID and CASHFREE_SECRET_KEY on the backend.'});return res.status(501).json({message:'Connect this endpoint to the current Cashfree Orders API/SDK using the credentials above.'});});
app.post('/api/payment/verify',(req,res)=>res.status(501).json({message:'Cashfree verification endpoint is ready for server-side implementation.'}));
app.post('/api/payment/webhook',(req,res)=>res.status(501).json({message:'Cashfree webhook route reserved; configure signature verification before production.'}));
app.get('/api/payment/status/:orderId',(req,res)=>res.json({orderId:req.params.orderId,status:'pending'}));

app.use((err,req,res,next)=>{console.error(err);res.status(500).json({message:'Internal server error'});});
const port=process.env.PORT||5000;
app.listen(port,()=>console.log(`ZEVQORA API running on http://localhost:${port}`));
