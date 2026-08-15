module.exports = function healthRoute(req,res){res.status(200).json({ok:true,service:'ZEVQORA backend',timestamp:new Date().toISOString()});};
