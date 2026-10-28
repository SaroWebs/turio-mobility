<?php

use App\Models\Customer;
use App\Models\SupportTicket;
use Laravel\Sanctum\Sanctum;

it('creates and lists a booking-independent support ticket', function () {
    $customer = Customer::create(['name' => 'Support Customer', 'phone' => '9600000020']);
    Sanctum::actingAs($customer);

    $response = $this->postJson('/api/customer-app/support/tickets', [
        'category' => 'insurance',
        'subject' => 'Explain an exclusion',
        'message' => 'Please explain the baggage exclusion before I make a booking.',
        'priority' => 'normal',
    ])->assertCreated()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.booking_id', null)
        ->assertJsonPath('data.messages.0.body', 'Please explain the baggage exclusion before I make a booking.');

    $ticket = SupportTicket::findOrFail($response->json('data.id'));

    $this->postJson("/api/customer-app/support/tickets/{$ticket->id}/messages", [
        'message' => 'I also need the provider policy wording.',
    ])->assertCreated();

    $this->getJson('/api/customer-app/support/tickets')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonCount(2, 'data.0.messages');
});

it('does not expose another customer support ticket', function () {
    $owner = Customer::create(['name' => 'Ticket Owner', 'phone' => '9600000021']);
    $other = Customer::create(['name' => 'Ticket Other', 'phone' => '9600000022']);
    Sanctum::actingAs($owner);
    $ticketId = $this->postJson('/api/customer-app/support/tickets', [
        'category' => 'general', 'subject' => 'Question', 'message' => 'A private question.',
    ])->json('data.id');

    Sanctum::actingAs($other);
    $this->postJson("/api/customer-app/support/tickets/{$ticketId}/messages", ['message' => 'Unauthorized reply'])
        ->assertForbidden();
    $this->getJson('/api/customer-app/support/tickets')->assertOk()->assertJsonCount(0, 'data');
});
