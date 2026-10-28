<?php

// Curated setup choices, including older vehicles still used by drivers.
// Extend this list as additional makes and models join the fleet.
return [
    'makes' => [
        'Maruti Suzuki' => ['Alto', 'Alto K10', 'Baleno', 'Celerio', 'Ciaz', 'Dzire', 'Eeco', 'Ertiga', 'Grand Vitara', 'Ignis', 'Invicto', 'S-Presso', 'Swift', 'Wagon R', 'XL6', 'Brezza', 'Fronx'],
        'Toyota' => ['Camry', 'Corolla Altis', 'Etios', 'Etios Liva', 'Fortuner', 'Glanza', 'Innova', 'Innova Crysta', 'Innova Hycross', 'Rumion', 'Urban Cruiser', 'Urban Cruiser Hyryder', 'Urban Cruiser Taisor'],
        'Hyundai' => ['Accent', 'Alcazar', 'Aura', 'Creta', 'Elantra', 'Eon', 'Exter', 'Grand i10', 'Grand i10 Nios', 'i10', 'i20', 'Santro', 'Venue', 'Verna', 'Xcent'],
        'Tata' => ['Altroz', 'Bolt', 'Harrier', 'Hexa', 'Indica', 'Indigo', 'Nexon', 'Nexon EV', 'Punch', 'Punch EV', 'Safari', 'Sumo', 'Tiago', 'Tiago EV', 'Tigor', 'Tigor EV', 'Zest'],
        'Mahindra' => ['Bolero', 'Bolero Neo', 'Marazzo', 'Scorpio', 'Scorpio N', 'Thar', 'TUV300', 'Verito', 'XUV300', 'XUV400', 'XUV500', 'XUV700', 'Xylo'],
        'Honda' => ['Amaze', 'BR-V', 'Brio', 'City', 'CR-V', 'Elevate', 'Jazz', 'Mobilio', 'WR-V'],
        'Kia' => ['Carens', 'Carnival', 'Seltos', 'Sonet', 'EV6'],
        'Renault' => ['Duster', 'Kiger', 'Kwid', 'Lodgy', 'Triber'],
        'Nissan' => ['Evalia', 'Kicks', 'Magnite', 'Micra', 'Sunny', 'Terrano'],
        'Skoda' => ['Fabia', 'Kodiaq', 'Kushaq', 'Octavia', 'Rapid', 'Slavia', 'Superb'],
        'Volkswagen' => ['Ameo', 'Jetta', 'Polo', 'Taigun', 'Tiguan', 'Vento', 'Virtus'],
        'MG' => ['Astor', 'Comet EV', 'Gloster', 'Hector', 'Hector Plus', 'Windsor EV', 'ZS EV'],
        'Ford' => ['EcoSport', 'Endeavour', 'Fiesta', 'Figo', 'Figo Aspire', 'Freestyle'],
        'Chevrolet' => ['Beat', 'Enjoy', 'Sail', 'Spark', 'Tavera'],
        'Force' => ['Gurkha', 'Traveller', 'Urbania'],
        'BYD' => ['Atto 3', 'e6', 'Seal'],
    ],
    'colors' => ['White', 'Silver', 'Grey', 'Black', 'Blue', 'Red', 'Brown', 'Beige', 'Green', 'Yellow', 'Orange', 'Gold', 'Purple'],
    'fuel_types' => ['petrol', 'diesel', 'cng', 'electric', 'hybrid'],
    'seats' => range(2, 12),
];
