<?php

namespace App\Support;

/**
 * Money helpers for the integer minor-unit invariant (SKY-MRD-001 §8.6,
 * domain invariant #2).
 *
 * All monetary math in the ledger is performed in integer minor units
 * (paise for INR). Floats are only tolerated at the boundary with legacy
 * callers and are converted immediately via toMinor(); they are never used
 * for arithmetic once inside the ledger.
 */
final class Money
{
    /** Minor units per major unit (100 paise = 1 INR). */
    public const SCALE = 100;

    /**
     * Convert a major-unit amount (e.g. rupees, possibly a float) to integer
     * minor units. Uses round() to avoid binary float truncation such as
     * (0.1 + 0.2) * 100 = 29.999999999999996.
     */
    public static function toMinor(int|float|string $major): int
    {
        return (int) round(((float) $major) * self::SCALE);
    }

    /** Convert integer minor units back to a major-unit float (display / decimal mirror). */
    public static function toMajor(int $minor): float
    {
        return $minor / self::SCALE;
    }

    /** Format minor units as a fixed 2-decimal string, e.g. 50000 -> "500.00". */
    public static function format(int $minor): string
    {
        return number_format($minor / self::SCALE, 2, '.', '');
    }
}
