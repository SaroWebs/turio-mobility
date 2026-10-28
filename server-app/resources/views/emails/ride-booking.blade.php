<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ride Booking Confirmation - Turiya Mobility</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #f97316, #ea580c);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .booking-id {
            background-color: rgba(255, 255, 255, 0.2);
            padding: 8px 16px;
            border-radius: 20px;
            display: inline-block;
        }
        .content {
            padding: 30px;
        }
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 12px;
        }
        .status-confirmed {
            background-color: #dcfce7;
            color: #166534;
        }
        .status-pending {
            background-color: #fef3c7;
            color: #92400e;
        }
        .trip-details {
            background-color: #f8fafc;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
        }
        .location-item {
            display: flex;
            align-items: flex-start;
            margin: 15px 0;
        }
        .location-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 15px;
            margin-top: 5px;
        }
        .pickup-dot {
            background-color: #22c55e;
        }
        .dropoff-dot {
            background-color: #ef4444;
        }
        .driver-card {
            background-color: #eff6ff;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            display: flex;
            align-items: center;
        }
        .driver-avatar {
            width: 60px;
            height: 60px;
            background-color: #3b82f6;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            margin-right: 15px;
        }
        .fare-box {
            background: linear-gradient(135deg, #f97316, #ea580c);
            color: white;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
        }
        .fare-amount {
            font-size: 36px;
            font-weight: bold;
        }
        .button {
            display: inline-block;
            padding: 14px 28px;
            background-color: #f97316;
            color: #ffffff;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            text-align: center;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #666;
            padding: 20px 30px;
            background-color: #f8fafc;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
        }
        .info-row:last-child {
            border-bottom: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="{{ asset('brand/turiya-logo.png') }}" alt="Turiya Mobility — Tours - Rides - Rentals" style="display:block;max-width:240px;width:100%;height:auto;margin:0 auto;">
            <p style="margin: 0; opacity: 0.9;">Your ride has been booked!</p>
            <div class="booking-id">{{ $booking['booking_number'] }}</div>
        </div>

        <div class="content">
            <p>Hello {{ $user->name ?? 'Valued Customer' }},</p>
            
            <p>Your ride has been successfully booked. Here are your trip details:</p>

            <div class="trip-details">
                <h3 style="margin-top: 0;">Trip Details</h3>
                
                <div class="location-item">
                    <div class="location-dot pickup-dot"></div>
                    <div>
                        <strong>Pickup</strong><br>
                        {{ $booking['pickup_location'] }}
                    </div>
                </div>

                @isset($booking['dropoff_location'])
                <div class="location-item">
                    <div class="location-dot dropoff-dot"></div>
                    <div>
                        <strong>Drop-off</strong><br>
                        {{ $booking['dropoff_location'] }}
                    </div>
                </div>
                @endisset

                <div class="info-row">
                    <span>Scheduled At</span>
                    <strong>{{ $booking['scheduled_at'] }}</strong>
                </div>

                @isset($booking['service_type'])
                <div class="info-row">
                    <span>Service Type</span>
                    <strong>{{ ucfirst(str_replace('_', ' ', $booking['service_type'])) }}</strong>
                </div>
                @endisset
            </div>

            @isset($driver)
            <div class="driver-card">
                <div class="driver-avatar">
                    {{ substr($driver['name'], 0, 1) }}
                </div>
                <div>
                    <strong>{{ $driver['name'] }}</strong><br>
                    <span style="color: #666;">{{ $driver['phone'] }}</span><br>
                    @isset($driver['vehicle_number'])
                    <span style="color: #666;">Vehicle: {{ $driver['vehicle_number'] }}</span>
                    @endisset
                </div>
            </div>
            @endisset

            <div class="fare-box">
                <div style="opacity: 0.9; margin-bottom: 5px;">Total Fare</div>
                <div class="fare-amount">₹{{ number_format($booking['total_fare'], 2) }}</div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{ route('ride-bookings.show', $booking['id']) }}" class="button">
                    Track Your Ride
                </a>
            </div>

            <p style="color: #666; font-size: 14px;">
                <strong>Important:</strong> Please be ready at the pickup location 5 minutes before the scheduled time.
                You can track your driver's location in real-time using the link above.
            </p>
        </div>

        <div class="footer">
            <p>© {{ date('Y') }} Turiya Mobility. All rights reserved.</p>
            <p>
                Need help? Contact our support team at support@skyslope.com<br>
                This email was sent to {{ $user->email ?? 'your email' }}.
            </p>
        </div>
    </div>
</body>
</html>
