<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $subject ?? 'Notification from Turiya Mobility' }}</title>
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
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f97316;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #f97316;
        }
        .content {
            margin-bottom: 30px;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #f97316;
            color: #ffffff;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #666;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
        .highlight {
            background-color: #fff3e0;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #f97316;
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="{{ asset('brand/turiya-logo.png') }}" alt="Turiya Mobility — Tours - Rides - Rentals" style="display:block;max-width:240px;width:100%;height:auto;margin:0 auto;">
        </div>

        <div class="content">
            @isset($greeting)
                <h2>{{ $greeting }}</h2>
            @endisset

            @isset($notificationMessage)
                <p>{{ $notificationMessage }}</p>
            @endisset

            @isset($highlight)
                <div class="highlight">
                    {{ $highlight }}
                </div>
            @endisset

            @isset($details)
                <div style="margin: 20px 0;">
                    @foreach($details as $label => $value)
                        <p><strong>{{ $label }}:</strong> {{ $value }}</p>
                    @endforeach
                </div>
            @endisset

            @isset($actionUrl)
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{{ $actionUrl }}" class="button">{{ $actionText ?? 'View Details' }}</a>
                </div>
            @endisset
        </div>

        <div class="footer">
            <p>© {{ date('Y') }} Turiya Mobility. All rights reserved.</p>
            <p>
                This email was sent to {{ $userEmail ?? 'you' }}.
                If you have any questions, please contact our support team.
            </p>
        </div>
    </div>
</body>
</html>
