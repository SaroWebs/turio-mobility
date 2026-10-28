<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ $tour->title }} - Tour brochure</title>
    <style>
        @page { margin: 46px 46px 58px; }
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 13px; line-height: 1.65; color: #20332e; }
        .brand { font-size: 12px; font-weight: bold; letter-spacing: 2px; color: #0d7769; }
        .eyebrow { text-transform: uppercase; font-size: 9px; letter-spacing: 1.5px; color: #52655f; margin-top: 24px; }
        h1 { font-size: 30px; line-height: 1.2; margin: 10px 0 16px; color: #113d33; overflow-wrap: break-word; }
        h2 { font-size: 17px; color: #0d7769; margin: 24px 0 10px; page-break-after: avoid; }
        h3 { font-size: 14px; margin: 15px 0 5px; page-break-after: avoid; }
        p { margin: 6px 0 12px; white-space: pre-line; overflow-wrap: break-word; }
        ul { padding-left: 17px; margin: 5px 0 12px; }
        li { margin-bottom: 4px; }
        .lead { font-size: 13px; line-height: 1.6; color: #52655f; }
        .facts { background: #edf5f1; padding: 16px 18px; margin: 20px 0; border-left: 4px solid #0d7769; }
        .facts p { margin: 3px 0; }
        .price { font-size: 18px; font-weight: bold; color: #113d33; }
        .small { font-size: 11px; color: #52655f; }
        .day { page-break-before: always; }
        .rule { border-top: 1px solid #dbe5df; padding-top: 12px; }
        .footer { position: fixed; bottom: -34px; left: 0; font-size: 8px; color: #52655f; }
    </style>
</head>
<body>
<div class="footer">HAPPYMILES / TOUR BROCHURE / {{ $generatedAt->format('d M Y') }}</div>
<div class="brand">HAPPYMILES</div>
<div class="eyebrow">{{ $tour->category?->name ?: 'Your next journey' }} @if($tour->region) / {{ $tour->region }} @endif</div>
<h1>{{ $tour->title }}</h1>
@if($tour->short_description)<p class="lead">{{ strip_tags($tour->short_description) }}</p>@endif
@unless($tour->is_active)<p><strong>DRAFT - Not yet published</strong></p>@endunless
<div class="facts">
    @if($tour->duration_days)<p><strong>{{ $tour->duration_days }} {{ Str::plural('day', $tour->duration_days) }} / {{ $tour->duration_nights }} {{ Str::plural('night', $tour->duration_nights) }}</strong></p>@endif
    @if($tour->start_location || $tour->end_location)<p>{{ $tour->start_location }} @if($tour->end_location) to {{ $tour->end_location }} @endif</p>@endif
    @if($tour->max_group_size)<p>Group size: {{ $tour->min_group_size }}-{{ $tour->max_group_size }} guests @if($tour->difficulty) / {{ ucfirst($tour->difficulty) }} @endif</p>@endif
    @if($tour->price_per_person !== null)<p class="price">INR {{ number_format($tour->getDiscountedPrice(), 2) }} / adult</p>@endif
    @if($tour->child_price !== null)<p>Child package price: INR {{ number_format((float) $tour->child_price, 2) }}</p>@endif
    <p class="small">Package reference prices. Departure prices and availability may vary; confirm the selected departure before booking.</p>
</div>
@if($tour->description)<h2>The experience</h2><p>{{ strip_tags($tour->description) }}</p>@endif
@if(count($tour->highlights ?? []))<h2>Trip highlights</h2><ul>@foreach($tour->highlights as $item)<li>{{ $item }}</li>@endforeach</ul>@endif
@if($days->isNotEmpty())
    <div class="day">
        <div class="brand">THE JOURNEY</div>
@foreach($days as $day => $stops)
        <h2>Day {{ $day }}</h2>
        @foreach($stops as $stop)
            <h3>@if($stop->time){{ substr($stop->time, 0, 5) }} / @endif{{ $stop->title }}</h3>
            @if($stop->start_location || $stop->end_location)<p class="small">{{ $stop->start_location }} @if($stop->end_location) to {{ $stop->end_location }} @endif @if($stop->distance_km) / {{ $stop->distance_km }} km @endif @if($stop->travel_time) / {{ $stop->travel_time }} @endif</p>@endif
            @if($stop->details)<p>{{ strip_tags($stop->details) }}</p>@endif
            @if(count($stop->activities ?? []))<p><strong>Activities:</strong> {{ implode(', ', $stop->activities) }}</p>@endif
            @foreach($stop->key_stops ?? [] as $keyStop)
                @if(is_array($keyStop))<p><strong>{{ $keyStop['name'] ?? '' }}</strong> {{ $keyStop['description'] ?? '' }}</p>@endif
            @endforeach
            @if($stop->accommodation)<p><strong>Stay:</strong> {{ $stop->accommodation }}</p>@endif
            @if(count($stop->meals_included ?? []))<p><strong>Meals:</strong> {{ implode(', ', $stop->meals_included) }}</p>@endif
            @if(count($stop->inclusions ?? []))<p><strong>Included today:</strong> {{ implode(', ', $stop->inclusions) }}</p>@endif
            @if(count($stop->exclusions ?? []))<p><strong>Not included today:</strong> {{ implode(', ', $stop->exclusions) }}</p>@endif
        @endforeach
@endforeach
    </div>
@endif
<div class="day">
    <div class="brand">BEFORE YOU TRAVEL</div>
    @if(count($tour->inclusions ?? []))<h2>What's included</h2><ul>@foreach($tour->inclusions as $item)<li>{{ $item }}</li>@endforeach</ul>@endif
    @if(count($tour->exclusions ?? []))<h2>What's not included</h2><ul>@foreach($tour->exclusions as $item)<li>{{ $item }}</li>@endforeach</ul>@endif
    @if($tour->cancellation_policy)<h2>Cancellation and changes</h2><p>{{ strip_tags($tour->cancellation_policy) }}</p>@endif
    @if(count($tour->faqs ?? []))
        <h2>Common questions</h2>
        @foreach($tour->faqs as $faq)
            @if(is_array($faq) && !empty($faq['question']))
                <h3>{{ $faq['question'] }}</h3>
                <p>{{ strip_tags($faq['answer'] ?? '') }}</p>
            @endif
        @endforeach
    @endif
    <h2>Plan your departure</h2>
    <p>Check the current tour page for departure dates, available seats and the final booking price. Your booking confirmation records the agreed travel details.</p>
    <p class="small rule">Generated from the saved tour details on {{ $generatedAt->format('d M Y, H:i') }} ({{ config('app.timezone') }}). A saved or printed brochure is a snapshot and may change as the tour is updated.</p>
</div>
</body>
</html>
