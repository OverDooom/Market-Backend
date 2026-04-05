const express = require('express');
const cors =require('cors');
const app = express();
const path = require('path');
const port = 3000;
// 1. استيراد Pool من مكتبة pg
const { Pool } = require('pg');

// بيانات الاتصال الخاصة بـ Supabase
const dbUri = "postgresql://postgres.gvrtyfcllmwbwmowgwba:B1wPhZrhbbVfhaEU@aws-1-eu-central-1.pooler.supabase.com:5432/postgres";

// 2. إعداد Pool للاتصال بـ Postgres
const pool = new Pool({
  connectionString: dbUri,
 });

app.use(cors());
 
app.get('/', async (req, res) => {
   try {
        // 3. تنفيذ الاستعلام (في pg النتيجة تعود في كائن يحتوي على rows)
        const result = await pool.query('SELECT * from products');
        res.json({ message: "Connected!", data: result.rows });
    } catch (err) {
        console.error("Connection Error:", err);
        res.status(500).json({ error: err.message });
    } 
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});

app.get('/file/:name', (req, res, next) => {
  const options = {
    root: path.join(__dirname, 'public'),
    dotfiles: 'deny',
    headers: {
      'x-timestamp': Date.now(),
      'x-sent': true
    }
  }

  const fileName = req.params.name
  res.sendFile(fileName, options, (err) => {
    if (err) {
     next(err);
    } else {
      console.log('Sent:', fileName)
    }
  })
});
