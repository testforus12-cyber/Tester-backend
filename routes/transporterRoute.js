import express from 'express';
import { addTiedUpCompany, calculatePrice, getAllTransporters, getPackingList, getTiedUpCompanies, getTemporaryTransporters, getTransporters, getTrasnporterDetails, savePckingList, deletePackingList, removeTiedUpVendor, updateVendor, getZoneMatrix, updateZoneMatrix, deleteZoneMatrix, saveWizardData, getWizardData } from '../controllers/transportController.js';
import multer from "multer";
import { protect } from '../middleware/authMiddleware.js';
import { uploadLimiter, apiLimiter, authLimiter } from '../middleware/rateLimiter.js';
import { addPrice, addTransporter, downloadTransporterTemplate, transporterLogin } from '../controllers/transporterAuth.js';
const router = express.Router();

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }  // e.g. 5MB limit
});

router.post("/auth/addtransporter", uploadLimiter, upload.single('sheet'), addTransporter);
router.get("/auth/downloadtemplate", downloadTransporterTemplate);
router.post("/auth/addprice", apiLimiter, addPrice);
router.post("/auth/signin", authLimiter, transporterLogin);



router.post('/calculate', protect, calculatePrice);
router.post("/addtiedupcompanies", protect, upload.single('priceChart'), addTiedUpCompany);
router.post("/add-tied-up", protect, addTiedUpCompany);
router.get("/gettiedupcompanies", protect, getTiedUpCompanies);
router.delete("/remove-tied-up", protect, removeTiedUpVendor); 

// Alias for older frontends: /api/transporter/temporary
// Normalizes query param casing and forwards to getTemporaryTransporters
router.get('/temporary', protect, (req, res, next) => {
  req.query.customerID = req.query.customerID || req.query.customerId || req.query.customerid;
  return getTemporaryTransporters(req, res, next);
});

router.get("/gettemporarytransporters", protect, getTemporaryTransporters);
router.get("/gettransporter", getTransporters);
router.get("/getalltransporter", getAllTransporters);
router.post("/savepackinglist", protect, savePckingList);
router.get("/getpackinglist", protect, getPackingList);
router.get("/gettransporterdetails/:id", getTrasnporterDetails);
//router.post('/addtiedupcompanies', addTiedUpCompanies);
router.delete('/deletepackinglist/:id', protect, deletePackingList);
router.put('/update-vendor/:id', protect, updateVendor);

// Zone Matrix CRUD endpoints
router.get('/zone-matrix/:vendorId', protect, getZoneMatrix);
router.put('/zone-matrix/:vendorId', protect, updateZoneMatrix);
router.delete('/zone-matrix/:vendorId', protect, deleteZoneMatrix);

// Wizard Data Sync endpoints
router.post('/wizard-data', protect, saveWizardData);
router.get('/wizard-data', protect, getWizardData);

export default router;
