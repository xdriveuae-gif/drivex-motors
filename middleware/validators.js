'use strict';

/** express-validator chains + a JSON error handler. */

const { body, validationResult } = require('express-validator');

const currentYear = new Date().getFullYear();

const vehicleValidators = [
  body('title').trim().notEmpty().withMessage('Title is required.').isLength({ max: 160 }),
  body('make').trim().notEmpty().withMessage('Make is required.').isLength({ max: 60 }),
  body('model').trim().notEmpty().withMessage('Model is required.').isLength({ max: 60 }),
  body('year')
    .notEmpty().withMessage('Year is required.')
    .bail()
    .toInt()
    .isInt({ min: 1950, max: currentYear + 1 })
    .withMessage(`Year must be between 1950 and ${currentYear + 1}.`),
  body('price')
    .notEmpty().withMessage('Price is required.')
    .bail()
    .toInt()
    .isInt({ min: 0 }).withMessage('Price must be a positive number.'),
  body('mileage').optional({ checkFalsy: true }).toInt().isInt({ min: 0 })
    .withMessage('Mileage must be a positive number.'),
  body('engine').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  body('transmission').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('fuel_type').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('body_type').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('color').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('vin').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 6000 })
];

const contactValidators = [
  body('name').trim().notEmpty().withMessage('Please enter your name.').isLength({ max: 120 }),
  body('email').trim().notEmpty().withMessage('Please enter your email.')
    .bail().isEmail().withMessage('Please enter a valid email address.')
    .isLength({ max: 160 }),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('subject').optional({ checkFalsy: true }).trim().isLength({ max: 160 }),
  body('message').trim().notEmpty().withMessage('Please enter a message.')
    .isLength({ min: 5, max: 4000 }).withMessage('Message must be 5–4000 characters.'),
  body('vehicle_id').optional({ checkFalsy: true }).toInt().isInt({ min: 1 })
];

const loginValidators = [
  body('username').trim().notEmpty().withMessage('Username is required.').isLength({ max: 80 }),
  body('password').notEmpty().withMessage('Password is required.').isLength({ max: 200 })
];

const submissionValidators = [
  // Contact
  body('full_name').trim().notEmpty().withMessage('Please enter your full name.').isLength({ max: 120 }),
  body('phone').trim().notEmpty().withMessage('Please enter your phone number.').isLength({ max: 40 }),
  body('whatsapp').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('email').trim().notEmpty().withMessage('Please enter your email.')
    .bail().isEmail().withMessage('Please enter a valid email address.').isLength({ max: 160 }),
  body('city').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  // Vehicle
  body('make').trim().notEmpty().withMessage('Make is required.').isLength({ max: 60 }),
  body('model').trim().notEmpty().withMessage('Model is required.').isLength({ max: 60 }),
  body('year').notEmpty().withMessage('Year is required.').bail().toInt()
    .isInt({ min: 1950, max: currentYear + 1 }).withMessage(`Year must be between 1950 and ${currentYear + 1}.`),
  body('trim').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  body('mileage').optional({ checkFalsy: true }).toInt().isInt({ min: 0 }).withMessage('Mileage must be a positive number.'),
  body('engine_size').optional({ checkFalsy: true }).trim().isLength({ max: 60 }),
  body('fuel_type').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('transmission').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('color').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('vin').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  // Condition
  body('owners_count').optional({ checkFalsy: true }).toInt().isInt({ min: 0, max: 50 }),
  body('mechanical_issues').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('additional_notes').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  // Pricing
  body('asking_price').optional({ checkFalsy: true }).toInt().isInt({ min: 0 }).withMessage('Asking price must be a positive number.')
];

/** Convert validation errors into a 422 JSON payload. */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(422).json({
    error: 'Please correct the highlighted fields.',
    errors: errors.array().map((e) => ({ field: e.path || e.param, message: e.msg }))
  });
}

module.exports = {
  vehicleValidators,
  contactValidators,
  loginValidators,
  submissionValidators,
  handleValidation
};
