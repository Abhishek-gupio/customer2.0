/**
 * @swagger
 * tags:
 *   name: Vehicles
 *   description: Vehicle management and health tracking
 */

/**
 * @swagger
 * /api/v1/vehicles:
 *   post:
 *     summary: Add a new vehicle
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - registrationNumber
 *             properties:
 *               registrationNumber:
 *                 type: string
 *                 example: DL10CZ1234
 *               make:
 *                 type: string
 *                 example: Honda
 *               model:
 *                 type: string
 *                 example: City
 *               variant:
 *                 type: string
 *                 example: V MT
 *               year:
 *                 type: number
 *                 example: 2021
 *               fuelType:
 *                 type: string
 *                 enum: [PETROL, DIESEL, CNG, EV, HYBRID, OTHER]
 *               vehicleType:
 *                 type: string
 *                 enum: [LUV, SUV, SEDAN, BIKE, HATCHBACK, TRUCK]
 *               currentOdometer:
 *                 type: number
 *                 example: 15000
 *     responses:
 *       201:
 *         description: Vehicle added successfully
 *   get:
 *     summary: List all vehicles for the customer
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of vehicles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   registrationNumber:
 *                     type: string
 *                   make:
 *                     type: string
 *                   isPrimary:
 *                     type: boolean
 *                   healthScore:
 *                     type: object
 *                     properties:
 *                       overallScore:
 *                         type: number
 */

/**
 * @swagger
 * /api/v1/vehicles/{id}:
 *   get:
 *     summary: Get vehicle details
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vehicle details
 *   put:
 *     summary: Update vehicle details
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentOdometer:
 *                 type: number
 *               model:
 *                 type: string
 *     responses:
 *       200:
 *         description: Vehicle updated
 *   delete:
 *     summary: Delete a vehicle (soft delete)
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vehicle deleted
 */

/**
 * @swagger
 * /api/v1/vehicles/{id}/primary:
 *   put:
 *     summary: Set vehicle as primary
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vehicle set as primary
 */

/**
 * @swagger
 * /api/v1/vehicles/{id}/health/recalculate:
 *   post:
 *     summary: Recalculate vehicle health score
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Health score recalculated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overallScore:
 *                   type: number
 *                 explanations:
 *                   type: array
 *                   items:
 *                     type: string
 */

/**
 * @swagger
 * /api/v1/vehicles/{id}/odometer:
 *   post:
 *     summary: Log Odometer Reading
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reading]
 *             properties:
 *               reading:
 *                 type: number
 *               date:
 *                 type: string
 *                 format: date
 *               source:
 *                 type: string
 *                 enum: [MANUAL, IMAGE_AI]
 *     responses:
 *       200:
 *         description: Odometer updated and health recalculated
 */

/**
 * @swagger
 * /api/v1/vehicles/{id}/odometer-ai:
 *   post:
 *     summary: Log Odometer via AI (Image Upload)
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [photo]
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Odometer read from image and updated
 */

/**
 * @swagger
 * /api/v1/vehicles/{vehicleId}/challans:
 *   get:
 *     summary: Get Challans for Vehicle
 *     tags: [Vehicles]
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
 *         description: List of challans
 */

/**
 * @swagger
 * /api/v1/vehicles/{vehicleId}/challans/sync:
 *   post:
 *     summary: Force Sync Challans from Parivahan
 *     tags: [Vehicles]
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
 *         description: Challans synced successfully
 */
