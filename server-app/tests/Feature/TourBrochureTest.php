<?php

use App\Models\Role;
use App\Models\Tour;
use App\Models\User;
use App\Services\TourBrochureService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function brochureTour(array $attributes = []): Tour
{
    return Tour::create(array_merge([
        'title' => 'Meghalaya Living Roots', 'slug' => 'brochure-'.uniqid(),
        'short_description' => 'Forest paths, village walks and time beside the water.',
        'description' => 'Discover the living-root bridges and green landscapes of Meghalaya with a small group. Explore at a comfortable pace, with time to enjoy each stop.',
        'duration_days' => 2, 'duration_nights' => 1, 'min_group_size' => 2, 'max_group_size' => 8,
        'price_per_person' => 12500, 'child_price' => 8500, 'discount' => 10,
        'region' => 'Meghalaya', 'start_location' => 'Shillong', 'end_location' => 'Shillong', 'difficulty' => 'moderate',
        'highlights' => ['Living-root bridge walk', 'Village visit with a local guide'],
        'inclusions' => ['Transport between listed stops', 'One night of accommodation', 'Breakfast on Day 2'],
        'exclusions' => ['Flights', 'Meals not listed in the itinerary', 'Personal purchases'],
        'cancellation_policy' => 'Contact the operator for cancellation and date-change terms before payment.',
        'available_from' => today()->subDay(), 'available_to' => today()->addMonths(3), 'is_active' => true,
    ], $attributes));
}

function brochureAdmin(): User
{
    $admin = User::create(['name' => 'Brochure admin', 'email' => 'brochure@example.com', 'password' => 'password']);
    $role = Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Administrator']);
    $admin->roles()->attach($role);

    return $admin;
}

it('provides a generated PDF and brochure links for every visible tour', function () {
    $tour = brochureTour();
    $this->getJson("/api/customer-app/public/tours/{$tour->id}")->assertOk()
        ->assertJsonPath('data.has_uploaded_brochure', false)
        ->assertJsonPath('data.brochure_url', route('public.tours.brochure', $tour));
    $response = $this->get("/api/customer-app/public/tours/{$tour->id}/brochure");
    $response->assertOk()->assertHeader('content-type', 'application/pdf')
        ->assertHeader('x-content-type-options', 'nosniff');
    expect($response->getContent())->toStartWith('%PDF-');
});

it('stores the designed PDF privately and prefers it without disabling generated downloads', function () {
    Storage::fake('local');
    $tour = brochureTour();
    $content = '%PDF-1.4 designed brochure';
    $this->actingAs(brochureAdmin())->post("/admin/tours/{$tour->id}/brochure", [
        'brochure' => UploadedFile::fake()->createWithContent('designed.pdf', $content),
    ])->assertRedirect()->assertSessionHasNoErrors();
    $tour->refresh();
    expect($tour->brochure_name)->toBe('designed.pdf');
    Storage::disk('local')->assertExists($tour->brochure_path);
    expect($tour->toArray())->not->toHaveKey('brochure_path');

    $this->get("/api/customer-app/public/tours/{$tour->id}/brochure")->assertOk()->assertDownload('meghalaya-living-roots-brochure.pdf')
        ->assertStreamedContent($content);
    $generated = $this->get("/api/customer-app/public/tours/{$tour->id}/brochure?source=generated");
    $generated->assertOk();
    expect($generated->getContent())->toStartWith('%PDF-')->not->toBe($content);
});

it('replaces the uploaded PDF safely and restores the generated default when removed', function () {
    Storage::fake('local');
    $tour = brochureTour();
    $this->actingAs(brochureAdmin());
    foreach (['first', 'second'] as $name) {
        $previous = $tour->fresh()->brochure_path;
        $this->post("/admin/tours/{$tour->id}/brochure", [
            'brochure' => UploadedFile::fake()->createWithContent($name.'.pdf', '%PDF-1.4 '.$name),
        ])->assertSessionHasNoErrors();
        if ($previous) {
            Storage::disk('local')->assertMissing($previous);
        }
    }
    $path = $tour->fresh()->brochure_path;
    $this->delete("/admin/tours/{$tour->id}/brochure")->assertRedirect();
    expect($tour->fresh()->brochure_path)->toBeNull();
    Storage::disk('local')->assertMissing($path);
    $this->get("/api/customer-app/public/tours/{$tour->id}/brochure")->assertOk();
    $this->get("/api/customer-app/public/tours/{$tour->id}/brochure?source=uploaded")->assertNotFound();
});

it('does not expose unpublished or unavailable tour brochures publicly', function (array $attributes) {
    Storage::fake('local');
    $tour = brochureTour($attributes);
    Storage::disk('local')->put('test/brochure.pdf', '%PDF-1.4 private');
    $tour->forceFill(['brochure_path' => 'test/brochure.pdf'])->save();
    foreach (['', '?source=generated', '?source=uploaded'] as $query) {
        $this->get("/api/customer-app/public/tours/{$tour->id}/brochure{$query}")->assertNotFound();
    }
    $this->actingAs(brochureAdmin())->get("/admin/tours/{$tour->id}/brochure?source=generated")->assertOk();
})->with([
    'draft' => [['is_active' => false]],
    'expired availability' => [['available_to' => today()->subDay()]],
    'future availability' => [['available_from' => today()->addDay()]],
]);

it('protects brochure management and rejects invalid uploads without losing the current file', function () {
    Storage::fake('local');
    $tour = brochureTour();
    Storage::disk('local')->put('test/current.pdf', '%PDF-1.4 original');
    $tour->forceFill(['brochure_path' => 'test/current.pdf'])->save();
    $this->post("/admin/tours/{$tour->id}/brochure")->assertRedirect('/login');
    $customer = User::create(['name' => 'Other user', 'email' => 'other@example.com', 'password' => 'password']);
    $this->actingAs($customer)->deleteJson("/admin/tours/{$tour->id}/brochure")->assertForbidden();
    $this->actingAs(brochureAdmin())->post("/admin/tours/{$tour->id}/brochure", [
        'brochure' => UploadedFile::fake()->image('not-a-pdf.png'),
    ])->assertSessionHasErrors('brochure');
    $this->post("/admin/tours/{$tour->id}/brochure", [
        'brochure' => UploadedFile::fake()->create('too-big.pdf', 20481, 'application/pdf'),
    ])->assertSessionHasErrors('brochure');
    expect($tour->fresh()->brochure_path)->toBe('test/current.pdf');
    Storage::disk('local')->assertExists('test/current.pdf');
});

it('renders current itinerary content and escapes markup in the brochure template', function () {
    $tour = brochureTour();
    foreach ([1 => 'Village and forest trail', 2 => 'River views and return to Shillong'] as $day => $title) {
        $tour->itineraries()->create([
            'day_number' => $day, 'stop_order' => 1, 'title' => $title, 'time' => '09:00',
            'details' => 'Meet your guide after breakfast. Walk at a comfortable pace and stop for photographs before continuing to the next destination.',
            'start_location' => $day === 1 ? 'Shillong' : 'Village stay', 'end_location' => $day === 1 ? 'Village stay' : 'Shillong',
            'activities' => ['Guided walk', 'Scenic stops'], 'meals_included' => ['breakfast'],
            'accommodation' => $day === 1 ? 'Village guesthouse' : null,
        ]);
    }
    $service = app(TourBrochureService::class);
    $pdf = $service->generate($tour);
    expect($pdf)->toStartWith('%PDF-');
    if ($path = getenv('BROCHURE_QA_OUTPUT')) {
        file_put_contents($path, $pdf);
    }
    $tour->itineraries()->first()->update(['title' => 'Updated <script>unsafe</script> itinerary']);
    expect($service->generate($tour))->not->toBe($pdf);
    $html = view('brochures.tour', ['tour' => $tour, 'days' => $tour->itineraries->groupBy('day_number'), 'generatedAt' => now()])->render();
    expect($html)->toContain('&lt;script&gt;')->not->toContain('<script>');
});
