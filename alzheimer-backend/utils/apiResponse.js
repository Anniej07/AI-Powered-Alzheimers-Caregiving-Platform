/**
 * Utility helpers for consistent API responses.
 * Usage: res.status(200).json(success({ data }))
 *        res.status(400).json(fail('Validation error'))
 */

const success = (data = {}, message = 'Success') => ({
  success: true,
  message,
  ...data,
});

const fail = (message = 'Error', errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return body;
};

const paginate = (data, total, page, limit) => ({
  success: true,
  total,
  page,
  pages: Math.ceil(total / limit),
  ...data,
});

module.exports = { success, fail, paginate };
