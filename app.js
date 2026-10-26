const express = require('express');
const cors = require('cors');
const audioRoutes = require('./routes/audioRoute');
const pdfRoutes = require('./routes/pdfRoute');
const userRouter = require('./routes/userRoutes.js');
const AppError = require('./utils/AppError');

const app = express();
app.use(cors());
app.get('/', (req, res) => {
  res.send('API is running');
});
// Move audio & pdf routes BEFORE json parser to allow multer multipart processing
app.use('/api/audio', audioRoutes);
app.use('/api/pdf', pdfRoutes);
app.use(express.json());
// /* ------------------------  STATIC FILES (public/) -------------------------- */
// app.use(express.static(path.join(__dirname, 'public')));

// /* ---------------------- 3) RATE LIMITING (before routes) --------------------- */
// const limiter = rateLimit({
//   max: 100,
//   windowMs: 60 * 60 * 1000,
//   message: 'Too many requests, please try again after an hour',
// });
// app.use('/api', limiter);

// /* ---------------------- 4) BODY PARSER (after security) ---------------------- */
// app.use(express.json({ limit: '10kb' }));
// app.use(urlencoded({ extended: true, limit: '10kb' }));

/* ---------------- 5) DATA SANITIZATION (mongo + xss ) ------------------- */
// app.use(mongoSanitize());
// app.use(xss());
// app.use(compression());
/* ------------------------------- 7) ROUTES ---------------------------------- */
// app.use((req, res, next) => {
//   console.log('CONTENT TYPE:', req.headers['content-type']);
//   next();
// });

app.use('/api/users', userRouter);

/* --------------------------- 8) 404 HANDLER --------------------------------- */
app.all(/.*/, (req, res, next) => {
  next(new AppError(`Can not find ${req.originalUrl} on this server!`, 404));
});

/* --------------------------- 9) GLOBAL ERROR HANDLER ------------------------- */
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || (err.name === 'MulterError' ? 400 : 500);
  const status = err.status || 'error';

  const response = {
    status,
    message: err.message,
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
});

module.exports = app;
