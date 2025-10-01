import express from 'express';
import { addTiedUpCompany, calculatePrice, getAllTransporters, getPackingList, getTiedUpCompanies, getTemporaryTransporters, getTransporters, getTrasnporterDetails, savePckingList, deletePackingList, removeTiedUpVendor } from '../controllers/transportController.js';
import multer from "multer";
import { protect } from '../middleware/authMiddleware.js';
import { addPrice, addTransporter, downloadTransporterTemplate, transporterLogin } from '../controllers/transporterAuth.js';
const router = express.Router();

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }  // e.g. 5MB limit
});

router.post("/auth/addtransporter", upload.single('sheet'), addTransporter);
router.get("/auth/downloadtemplate", downloadTransporterTemplate);
router.post("/auth/addprice", addPrice);
router.post("/auth/signin", transporterLogin);
router.delete("/auth/remove-tied-up", protect, removeTiedUpVendor);


router.post('/calculate', protect, calculatePrice);
router.post("/addtiedupcompanies", protect, upload.single('priceChart'), addTiedUpCompany);
router.post("/add-tied-up", protect, addTiedUpCompany);
router.get("/gettiedupcompanies", protect, getTiedUpCompanies);
router.get("/gettemporarytransporters", protect, getTemporaryTransporters);
router.get("/gettransporter", getTransporters);
router.get("/getalltransporter", getAllTransporters);
router.post("/savepackinglist", protect, savePckingList);
router.get("/getpackinglist", protect, getPackingList);
router.get("/gettransporterdetails/:id", getTrasnporterDetails);
//router.post('/addtiedupcompanies', addTiedUpCompanies);
router.delete('/deletepackinglist/:id', protect, deletePackingList);
export default router;
