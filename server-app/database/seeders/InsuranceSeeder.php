<?php

namespace Database\Seeders;

use App\Models\InsuranceClaim;
use App\Models\Customer;
use App\Models\InsurancePolicy;
use Illuminate\Database\Seeder;

class InsuranceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $customers = Customer::limit(5)->get();

        foreach ($customers as $customer) {
            $policies = [
                [
                    'policy_number' => InsurancePolicy::generatePolicyNumber(),
                    'policy_type' => 'comprehensive',
                    'coverage_amount' => 500000,
                    'premium' => 20000,
                    'start_date' => now()->subMonths(6),
                    'end_date' => now()->addMonths(6),
                    'status' => 'active',
                    'terms_accepted_at' => now(),
                ],
                [
                    'policy_number' => InsurancePolicy::generatePolicyNumber(),
                    'policy_type' => 'third_party',
                    'coverage_amount' => 1000000,
                    'premium' => 15000,
                    'start_date' => now()->subMonths(3),
                    'end_date' => now()->addMonths(9),
                    'status' => 'active',
                    'terms_accepted_at' => now(),
                ],
            ];

            foreach ($policies as $policyData) {
                $policy = $customer->insurancePolicies()->create($policyData);

                if ($policy->policy_type === 'comprehensive') {
                    $claims = [
                        [
                            'claim_number' => InsuranceClaim::generateClaimNumber(),
                            'customer_id' => $customer->id,
                            'incident_date' => now()->subDays(30),
                            'description' => 'Minor collision at intersection during rainy weather',
                            'claim_amount' => 15000,
                            'status' => 'approved',
                            'approved_amount' => 15000,
                            'resolved_at' => now()->subDays(20),
                        ],
                        [
                            'claim_number' => InsuranceClaim::generateClaimNumber(),
                            'customer_id' => $customer->id,
                            'incident_date' => now()->subDays(60),
                            'description' => 'Scratch damage while parking',
                            'claim_amount' => 5000,
                            'status' => 'pending',
                        ],
                    ];

                    foreach ($claims as $claimData) {
                        $policy->claims()->create($claimData);
                    }
                }

                $careRequests = [
                    [
                        'care_type' => 'emergency',
                        'status' => 'completed',
                        'description' => 'Minor accident assistance provided',
                        'cost' => 2000,
                        'notes' => 'Emergency Services Ltd',
                        'resolved_at' => now()->subDays(14),
                        'serviceable_type' => \App\Models\CarRental::class,
                        'serviceable_id' => 1,
                    ],
                    [
                        'care_type' => 'roadside',
                        'status' => 'active',
                        'description' => 'Vehicle breakdown assistance',
                        'cost' => 1000,
                        'notes' => 'Roadside Assistance Co',
                        'serviceable_type' => \App\Models\RideBooking::class,
                        'serviceable_id' => 1,
                    ],
                ];

                foreach ($careRequests as $careData) {
                    $customer->extendedCareRequests()->create($careData);
                }
            }
        }
    }
}
