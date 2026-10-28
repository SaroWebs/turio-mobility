<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Wishlist extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'service_type',
        'service_id',
    ];

    protected $casts = [
        'service_type' => 'string',
        'service_id' => 'string',
    ];

    /**
     * Get the customer that owns the wishlist item.
     */
    public function customer()
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    /**
     * Check if a tour is in the user's wishlist.
     */
    public static function isTourInWishlist(int $customerId, string|int $tourId): bool
    {
        return Wishlist::where('customer_id', $customerId)
            ->where('service_type', 'tour')
            ->where('service_id', (string) $tourId)
            ->exists();
    }

    /**
     * Check if a rental is in the user's wishlist.
     */
    public static function isRentalInWishlist(int $customerId, string|int $rentalId): bool
    {
        return Wishlist::where('customer_id', $customerId)
            ->where('service_type', 'rental')
            ->where('service_id', (string) $rentalId)
            ->exists();
    }
}
