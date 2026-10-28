# Seed data

Run from `server-app` after `php artisan migrate`.

## Administrators and Northeast catalog

`php artisan db:seed --class=NortheastCatalogSeeder`

This creates or updates 20 destinations and matching places across Northeast India, eight tours, 46 daily itinerary entries, and three future departures per tour. Relationships use slugs and resolved IDs, not fixed numeric IDs. Tours use the current `price_per_person`, duration, category, itinerary and schedule fields. Destination map coordinates use `latitude` and `longitude` in decimal degrees, shared with their matching places. Pins represent the named town or attraction, not a confirmed pickup address. Kaziranga uses the [UNESCO property coordinate](https://whc.unesco.org/en/list/337/maps/): 26.666667 N, 93.416667 E.

The catalog contains Assam Rhino & River Trail, Meghalaya Waterfall Circuit, Tawang Tales: The High Road, Ziro & Apatani Stories, Sikkim Valleys & Monasteries, Nagaland Hills & Heritage, Loktak Manipur Weekend, and Grand Northeast Discovery. Prices and departures are demonstration data.

Three admin-role accounts are seeded:

- `admin@skyslope.com`
- `operations.admin@skyslope.com`
- `content.admin@skyslope.com`

New accounts use `SEED_ADMIN_PASSWORD`. In local and testing environments it defaults to `password`; other environments require an explicit value. Existing account passwords and profiles are preserved. `UserSeeder` can be run separately to create just the accounts and roles.

## Other entry points

`php artisan db:seed` retains the full marketplace setup, including fleet, customers, CMS and coupons. Use the catalog-only command above when only admins, destinations and tours are needed.

`PlaceSeeder`, `DestinationSeeder`, `TourSeeder` and `ItinerarySeeder` use the same catalog definitions and create their required dependencies. `PlaceCategorySeeder` and `CarCategorySeeder` can also be rerun without duplicating their categories.

Catalog reruns update seeded content by slug. They preserve existing departure inventory, status and price overrides; no bookings or existing records are deleted. New departures are created at 14, 35 and 63 days from the run date, staggered by tour, with zero booked/reserved seats. A later-day run adds new future departures while retaining previous departures. `migrate:fresh` is not needed for reseeding an existing database.
