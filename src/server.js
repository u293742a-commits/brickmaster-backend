const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`BrickMaster ERP API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
