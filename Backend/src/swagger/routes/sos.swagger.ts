/**
 * @swagger
 * tags:
 *   name: SOS
 *   description: Emergency SOS and Contact Management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SOSRequest:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the SOS request
 *         customerId:
 *           type: string
 *           description: The customer ID
 *         latitude:
 *           type: number
 *           description: Latitude of the emergency location
 *         longitude:
 *           type: number
 *           description: Longitude of the emergency location
 *         type:
 *           type: string
 *           enum: [MEDICAL, POLICE, MECHANICAL, ACCIDENT, OTHER]
 *           description: Type of emergency
 *         status:
 *           type: string
 *           enum: [ACTIVE, RESOLVED, CANCELLED]
 *           description: Status of the SOS request
 *         address:
 *           type: string
 *           description: Address of the emergency location
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         resolvedAt:
 *           type: string
 *           format: date-time
 *           description: Resolution timestamp
 *     EmergencyContact:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the contact
 *         name:
 *           type: string
 *           description: Name of the contact
 *         phoneNumber:
 *           type: string
 *           description: Phone number of the contact
 *         relation:
 *           type: string
 *           description: Relation to the customer
 *         priority:
 *           type: integer
 *           description: Priority of the contact (1 is highest)
 */

/**
 * @swagger
 * /api/v1/sos:
 *   post:
 *     summary: Trigger an SOS alert
 *     tags: [SOS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latitude
 *               - longitude
 *               - type
 *             properties:
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [MEDICAL, POLICE, MECHANICAL, ACCIDENT, OTHER]
 *               address:
 *                 type: string
 *               metadata:
 *                 type: object
 *                 description: Additional data like trigger source (e.g., HARSH_BRAKING)
 *     responses:
 *       201:
 *         description: SOS request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SOSRequest'
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/v1/sos/{id}/resolve:
 *   post:
 *     summary: Resolve an active SOS request
 *     tags: [SOS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: SOS Request ID
 *     responses:
 *       200:
 *         description: SOS request resolved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SOSRequest'
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/v1/sos/nearby-help:
 *   get:
 *     summary: Find nearby emergency services
 *     tags: [SOS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [MEDICAL, POLICE, MECHANICAL, ACCIDENT, OTHER]
 *     responses:
 *       200:
 *         description: List of nearby services
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   address:
 *                     type: string
 *                   location:
 *                     type: object
 *                     properties:
 *                       lat:
 *                         type: number
 *                       lng:
 *                         type: number
 *                   rating:
 *                     type: number
 *                   placeId:
 *                     type: string
 *                   types:
 *                     type: array
 *                     items:
 *                       type: string
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/v1/sos/contacts:
 *   get:
 *     summary: List emergency contacts
 *     tags: [SOS]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of emergency contacts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EmergencyContact'
 *       500:
 *         description: Internal server error
 *   post:
 *     summary: Add an emergency contact
 *     tags: [SOS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phoneNumber
 *             properties:
 *               name:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               relation:
 *                 type: string
 *               priority:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Contact added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmergencyContact'
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/v1/sos/contacts/{id}:
 *   delete:
 *     summary: Delete an emergency contact
 *     tags: [SOS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Contact ID
 *     responses:
 *       204:
 *         description: Contact deleted successfully
 *       500:
 *         description: Internal server error
 */
