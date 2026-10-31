require('dotenv').config();
const mongoose   = require('mongoose');
const User       = require('../models/User');
const Medication = require('../models/Medication');
const Prescription = require('../models/Prescription');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected – seeding demo data…');

  // Wipe existing seed accounts
  await User.deleteMany({ email: /@demo\.com$/ });

  // Create users (pre-save hook handles bcrypt hashing)
  const doctor = await User.create({
    name: 'Dr. Sarah Mitchell', email: 'doctor@demo.com', password: 'Demo@1234',
    role: 'doctor', phone: '+11234567890', specialization: 'Neurology',
    hospital: 'City General Hospital', licenseNumber: 'MED-2024-001',
  });

  const caregiver = await User.create({
    name: 'James Wilson', email: 'caregiver@demo.com', password: 'Demo@1234',
    role: 'caregiver', phone: '+10987654321',
  });

  const patient = await User.create({
  name: 'Robert Thompson', email: 'patient@demo.com', password: 'Demo@1234',
    role: 'patient', phone: '9342365178',
    dateOfBirth: new Date('1948-05-12'),
    gender: 'male',
    diagnosisStage: 'moderate',
    medicalHistory: ['Hypertension', 'Type 2 Diabetes', 'Alzheimer\'s Disease (diagnosed 2021)'],
    emergencyContact: { name: 'Mary Thompson', phone: '+11122334466', relation: 'Spouse' },
    assignedDoctors:    [doctor._id],
    assignedCaregivers: [caregiver._id],
  });

  // Link
  // Create family member account
  const family = await User.create({
    name:  'Emily Thompson',
    email: 'family@demo.com',
    password: 'Demo@1234',
    role:  'family',
    phone: '+1 555 0104',
  });

  doctor.patients.push(patient._id);
  caregiver.patients.push(patient._id);
  family.patients.push(patient._id);

  await doctor.save();
  await caregiver.save();
  await family.save();

  // Link patient to family member
  patient.assignedCaregivers.push(family._id);
  await patient.save();

  // Prescription
  const presc = await Prescription.create({
    patient:  patient._id,
    doctor:   doctor._id,
    diagnosis: 'Moderate Alzheimer\'s Disease with Hypertension',
    medications: [
      { name: 'Donepezil',   dosage: '10mg', frequency: 'once_daily', duration: '6 months', instructions: 'Take at bedtime' },
      { name: 'Memantine',   dosage: '20mg', frequency: 'twice_daily', duration: '6 months', instructions: 'Take with or without food' },
      { name: 'Amlodipine',  dosage: '5mg',  frequency: 'once_daily', duration: 'Ongoing',  instructions: 'Take in the morning' },
    ],
    notes: 'Monitor cognitive function monthly. Reassess in 3 months.',
    followUpDate: new Date(Date.now() + 90 * 86400000),
    expiryDate:   new Date(Date.now() + 180 * 86400000),
    sharedWith: [caregiver._id],
  });

  // Medications with schedules
  await Medication.create({
    patient: patient._id, addedBy: doctor._id, prescription: presc._id,
    name: 'Donepezil', genericName: 'Donepezil Hydrochloride',
    dosage: { amount: 10, unit: 'mg' },
    frequency: 'once_daily', scheduledTimes: ['21:00'],
    route: 'oral', instructions: 'Take at bedtime',
    sideEffects: ['Nausea', 'Diarrhea', 'Insomnia'],
    startDate: new Date(), isActive: true, pillsRemaining: 90,
  });

  await Medication.create({
    patient: patient._id, addedBy: doctor._id, prescription: presc._id,
    name: 'Memantine', dosage: { amount: 20, unit: 'mg' },
    frequency: 'twice_daily', scheduledTimes: ['08:00', '20:00'],
    route: 'oral', instructions: 'Take with or without food',
    startDate: new Date(), isActive: true, pillsRemaining: 180,
  });

  await Medication.create({
    patient: patient._id, addedBy: doctor._id, prescription: presc._id,
    name: 'Amlodipine', dosage: { amount: 5, unit: 'mg' },
    frequency: 'once_daily', scheduledTimes: ['08:00'],
    route: 'oral', instructions: 'Take in the morning',
    startDate: new Date(), isActive: true, pillsRemaining: 90,
  });

 console.log('✅  Seed complete! Demo credentials:');
  console.log('   Doctor:    doctor@demo.com    / Demo@1234');
  console.log('   Caregiver: caregiver@demo.com / Demo@1234');
  console.log('   Patient:   patient@demo.com   / Demo@1234');
  console.log('   Family:    family@demo.com    / Demo@1234');

  await mongoose.disconnect();
};

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
