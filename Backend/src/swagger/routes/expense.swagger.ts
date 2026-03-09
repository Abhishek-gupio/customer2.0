/**
 * @swagger
 * tags:
 *   name: Expenses
 *   description: Expense tracking, Fuel intelligence, and Warranty management
 */

/**
 * @swagger
 * /api/v1/expenses:
 *   post:
 *     summary: Create an expense (Manual or with Receipt)
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - category
 *             properties:
 *               amount:
 *                 type: number
 *               category:
 *                 type: string
 *                 enum: [FUEL, TOLL, PARKING, SERVICE, INSURANCE, CHALLAN, EMI, OTHER]
 *               vehicleId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               merchantName:
 *                 type: string
 *               notes:
 *                 type: string
 *               receipt:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Expense created
 *   get:
 *     summary: List expenses
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of expenses
 */

/**
 * @swagger
 * /api/v1/expenses/parse/text:
 *   post:
 *     summary: Parse expense from text (SMS/Notification)
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dryRun
 *         schema:
 *           type: boolean
 *         description: If true, returns parsed data without creating expense
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *               source:
 *                 type: string
 *                 enum: [SMS, NOTIFICATION, UPI]
 *                 default: SMS
 *     responses:
 *       200:
 *         description: Parsed expense data
 */

/**
 * @swagger
 * /api/v1/expenses/parse/receipt:
 *   post:
 *     summary: Parse expense from receipt image (OCR)
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: OCR results and parsed data
 */

/**
 * @swagger
 * /api/v1/expenses/parse/voice:
 *   post:
 *     summary: Parse expense from voice command (Audio)
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Audio transcribed and parsed via AI
 */

/**
 * @swagger
 * /api/v1/expenses/summary:
 *   get:
 *     summary: Get expense summary/analytics
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics summary
 */

/**
 * @swagger
 * /api/v1/expenses/budgets:
 *   post:
 *     summary: Set a budget for a category
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - amount
 *             properties:
 *               category:
 *                 type: string
 *                 enum: [FUEL, TOLL, PARKING, SERVICE, INSURANCE, CHALLAN, EMI, OTHER]
 *               amount:
 *                 type: number
 *               period:
 *                 type: string
 *                 default: MONTHLY
 *     responses:
 *       200:
 *         description: Budget set
 */

/**
 * @swagger
 * /api/v1/expenses/fuel-prices:
 *   get:
 *     summary: Get fuel prices for a city
 *     tags: [Expenses - Fuel]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: city
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Current prices
 */

/**
 * @swagger
 * /api/v1/expenses/fuel-prices/compare:
 *   get:
 *     summary: Compare fuel prices with nearby cities
 *     tags: [Expenses - Fuel]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Comparison data
 */

/**
 * @swagger
 * /api/v1/expenses/warranty/service-records:
 *   post:
 *     summary: Log a vehicle service record
 *     tags: [Expenses - Warranty]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vehicleId
 *               - serviceType
 *             properties:
 *               vehicleId:
 *                 type: string
 *               serviceType:
 *                 type: string
 *               garageName:
 *                 type: string
 *               odometerAtService:
 *                 type: number
 *               parts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     partType:
 *                       type: string
 *                     cost:
 *                       type: number
 *                     warrantyMonths:
 *                       type: number
 *     responses:
 *       201:
 *         description: Service record created
 */

/**
 * @swagger
 * /api/v1/expenses/warranty/vehicles/{vehicleId}/history:
 *   get:
 *     summary: Get full service history for a vehicle
 *     tags: [Expenses - Warranty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service records history
 */

/**
 * @swagger
 * /api/v1/expenses/warranty/vehicles/{vehicleId}/status:
 *   get:
 *     summary: Get current warranty status of all parts
 *     tags: [Expenses - Warranty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Warranty checklist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 active:
 *                   type: array
 *                   items:
 *                     type: object
 *                 expiring:
 *                   type: array
 *                   items:
 *                     type: object
 *                 expired:
 *                   type: array
 *                   items:
 *                     type: object
 */

/**
 * @swagger
 * /api/v1/expenses/warranty/providers:
 *   get:
 *     summary: Get list of service providers (garages) used by the user
 *     tags: [Expenses - Warranty]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of garage/merchant names
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */

/**
 * @swagger
 * /api/v1/expenses/insights:
 *   get:
 *     summary: Get weekly spending insights, tips, and recurring expenses
 *     tags: [Expenses - Intelligence]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Weekly digest and smart tips
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 weeklyDigest:
 *                   type: object
 *                   properties:
 *                     totalSpent:
 *                       type: number
 *                     breakdown:
 *                       type: array
 *                     vsLastWeek:
 *                       type: object
 *                 recurringExpenses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category:
 *                         type: string
 *                       merchantName:
 *                         type: string
 *                       frequency:
 *                         type: string
 *                 smartTips:
 *                   type: array
 *                   items:
 *                     type: string
 */

/**
 * @swagger
 * /api/v1/expenses/vehicles/{vehicleId}/cost-per-km:
 *   get:
 *     summary: Calculate Total Cost of Ownership (TCO) per KM
 *     tags: [Expenses - Intelligence]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cost per KM analysis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 costPerKm:
 *                   type: number
 *                 totalKm:
 *                   type: number
 *                 totalExpenses:
 *                   type: number
 *                 categoryBreakdownPerKm:
 *                   type: array
 */

/**
 * @swagger
 * /api/v1/expenses/anomalies/check:
 *   post:
 *     summary: Check for expense anomalies before saving
 *     tags: [Expenses - Intelligence]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - category
 *             properties:
 *               amount:
 *                 type: number
 *               category:
 *                 type: string
 *               merchantName:
 *                 type: string
 *               vehicleId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Anomaly detection result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasAnomaly:
 *                   type: boolean
 *                 anomalies:
 *                   type: array
 *                   items:
 *                     type: string
 *                 severity:
 *                   type: string
 *                   enum: [LOW, MEDIUM, HIGH]
 */
