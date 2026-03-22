#!/usr/bin/env python3
"""
Add 20 more donors and 10 hospitals to SmartBlood database
"""

import os
import sys
from datetime import datetime, timedelta
import random

# Fix encoding for Windows
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from pymongo import MongoClient
    from pymongo.errors import DuplicateKeyError
    import bcrypt
except ImportError:
    print("❌ Required packages not found. Installing...")
    os.system("pip install pymongo bcrypt")
    from pymongo import MongoClient
    from pymongo.errors import DuplicateKeyError
    import bcrypt

# Database connection
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/smartblood')

# Sri Lankan Districts
DISTRICTS = [
    'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matara',
    'Galle', 'Hambantota', 'Jaffna', 'Batticaloa', 'Trincomalee',
    'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla',
    'Nuwara Eliya', 'Kegalle', 'Ratnapura'
]

BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
GENDERS = ['male', 'female']

# Sri Lanka coordinates (approximate)
SRI_LANKA_COORDS = {
    'Colombo': [79.8612, 6.9271],
    'Gampaha': [80.0100, 7.0970],
    'Kandy': [80.6337, 7.2906],
    'Galle': [80.2168, 6.0535],
    'Matara': [80.5393, 5.7489],
    'Jaffna': [80.7891, 9.6615],
    'Batticaloa': [81.7957, 7.7083],
    'Trincomalee': [81.2336, 8.5711],
    'Kurunegala': [80.6347, 7.4803],
    'Anuradhapura': [80.7137, 8.3093],
    'Nuwara Eliya': [80.7830, 6.9271],
}

def hash_password(password):
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def generate_donors(count=20):
    """Generate donor data"""
    donors = []
    first_names = [
        'Kamal', 'Roshan', 'Dilshan', 'Sanath', 'Sanjith',
        'Mahesh', 'Ravindra', 'Kumar', 'Prasad', 'Ananda',
        'Ravi', 'Anil', 'Suresh', 'Mohan', 'David',
        'Samantha', 'Priya', 'Laksmi', 'Nirmala', 'Harini',
        'Nadeesha', 'Lakshmi', 'Deepa', 'Chithra', 'Manjula',
    ]
    
    last_names = [
        'Perera', 'Silva', 'Kumar', 'Fernando', 'Jayasinghe',
        'Gunawardena', 'Wickramasinghe', 'Alwis', 'Pieris', 'Dissanayake',
    ]
    
    for i in range(count):
        first = random.choice(first_names)
        last = random.choice(last_names)
        name = f"{first} {last}"
        email = f"donor{i+1}@smartblood.lk"
        blood = random.choice(BLOOD_TYPES)
        district = random.choice(DISTRICTS)
        coords = SRI_LANKA_COORDS.get(district, [80.7678, 7.0833])
        
        # Add some randomness to coordinates (within ~50km)
        lat = coords[1] + random.uniform(-0.5, 0.5)
        lon = coords[0] + random.uniform(-0.5, 0.5)
        
        donor = {
            'name': name,
            'email': email,
            'password': hash_password(f'Password@{i+1}'),
            'bloodType': blood,
            'weight': random.randint(50, 100),
            'address': f"{random.randint(10, 500)} Main Street, {district}",
            'phone': f"+9477{random.randint(1000000, 9999999)}",
            'district': district,
            'gender': random.choice(GENDERS),
            'location': {
                'type': 'Point',
                'coordinates': [lon, lat]
            },
            'xp': random.randint(0, 5000),
            'totalDonations': random.randint(0, 30),
            'isActive': True,
            'role': 'donor',
            'dateOfBirth': datetime.now() - timedelta(days=random.randint(18*365, 65*365)),
            'lastDonationDate': datetime.now() - timedelta(days=random.randint(0, 730)) if random.choice([True, False]) else None,
            'createdAt': datetime.now(),
            'updatedAt': datetime.now(),
        }
        donors.append(donor)
    
    return donors

def generate_hospitals(count=10):
    """Generate hospital data"""
    hospitals = []
    hospital_names = [
        'General Hospital', 'Central Medical', 'City Care Hospital',
        'National Blood Bank', 'Regional Medical Center', 'District Hospital',
        'Teaching Hospital', 'Emergency Care Center', 'Specialized Blood Bank',
        'Community Medical Hospital'
    ]
    
    city_names = [
        'Colombo', 'Kandy', 'Galle', 'Matara', 'Jaffna',
        'Batticaloa', 'Trincomalee', 'Kurunegala', 'Anuradhapura', 'Nuwara Eliya'
    ]
    
    doctor_names = [
        'Dr. Perera', 'Dr. Silva', 'Dr. Kumar', 'Dr. Fernando', 'Dr. Jayasinghe',
        'Dr. Gunawardena', 'Dr. Wickramasinghe', 'Dr. Alwis', 'Dr. Pieris', 'Dr. Dissanayake'
    ]
    
    for i in range(count):
        hospital_name = f"{random.choice(hospital_names)} {city_names[i]}"
        city = city_names[i]
        coords = SRI_LANKA_COORDS.get(city, [80.7678, 7.0833])
        
        # Add slight randomness to coordinates
        lat = coords[1] + random.uniform(-0.1, 0.1)
        lon = coords[0] + random.uniform(-0.1, 0.1)
        
        hospital = {
            'name': hospital_name,
            'email': f"hospital{i+1}@smartblood.lk",
            'password': hash_password(f'Hospital@{i+1}'),
            'address': f"{random.randint(10, 500)} Hospital Road, {city}",
            'district': city,
            'phone': f"+9411{random.randint(2000000, 9999999)}",
            'contactPerson': random.choice(doctor_names),
            'location': {
                'type': 'Point',
                'coordinates': [lon, lat]
            },
            'facilities': [
                'Blood Bank',
                'Emergency Ward',
                'Laboratory',
                'Transfusion Service'
            ] + (
                ['ICU', 'Surgery Theater'] if random.choice([True, False]) else []
            ),
            'isActive': True,
            'role': 'hospital',
            'operatingHours': {
                'open': '08:00',
                'close': '18:00'
            },
            'createdAt': datetime.now(),
            'updatedAt': datetime.now(),
        }
        hospitals.append(hospital)
    
    return hospitals

def insert_to_mongodb():
    """Insert donors and hospitals to MongoDB"""
    try:
        print("[*] Connecting to MongoDB...")
        client = MongoClient(MONGODB_URI)
        db = client['smartblood']
        
        # Test connection
        client.admin.command('ping')
        print("[+] Connected to MongoDB\n")
        
        # Add Donors
        print("[+] Adding 20 new donors...")
        donors = generate_donors(20)
        users_collection = db['users']
        
        added_donors = 0
        failed_donors = 0
        for donor in donors:
            try:
                result = users_collection.insert_one(donor)
                added_donors += 1
            except DuplicateKeyError:
                print(f"[!] Donor email already exists: {donor['email']}")
                failed_donors += 1
            except Exception as e:
                print(f"[-] Error adding donor: {e}")
                failed_donors += 1
        
        print(f"[+] Added {added_donors} donors (Failed: {failed_donors})\n")
        
        # Add Hospitals
        print("[+] Adding 10 new hospitals...")
        hospitals = generate_hospitals(10)
        hospitals_collection = db['hospitals']
        
        added_hospitals = 0
        failed_hospitals = 0
        for hospital in hospitals:
            try:
                result = hospitals_collection.insert_one(hospital)
                added_hospitals += 1
            except DuplicateKeyError:
                print(f"[!] Hospital email already exists: {hospital['email']}")
                failed_hospitals += 1
            except Exception as e:
                print(f"[-] Error adding hospital: {e}")
                failed_hospitals += 1
        
        print(f"[+] Added {added_hospitals} hospitals (Failed: {failed_hospitals})\n")
        
        # Get updated counts
        total_donors = users_collection.count_documents({'role': 'donor'})
        total_hospitals = hospitals_collection.count_documents({'role': 'hospital'})
        
        print("============================================")
        print(f"[*] Database Summary:")
        print(f"    - Total Donors: {total_donors}")
        print(f"    - Total Hospitals: {total_hospitals}")
        print("============================================\n")
        
        client.close()
        return added_donors, added_hospitals
        
    except Exception as e:
        print(f"[-] Connection error: {e}")
        print("[!] Make sure MongoDB is running and MONGODB_URI is correct")
        return 0, 0

if __name__ == '__main__':
    print("\n[*] SmartBlood - Add More Donors & Hospitals\n")
    print("============================================\n")
    
    added_donors, added_hospitals = insert_to_mongodb()
    
    if added_donors > 0 or added_hospitals > 0:
        print("[+] Database update completed successfully!")
    else:
        print("[!] No data was added. Check your database connection.")
