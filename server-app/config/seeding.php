<?php

return [
    'admin_password' => env('SEED_ADMIN_PASSWORD', in_array(env('APP_ENV', 'production'), ['local', 'testing'], true) ? 'password' : null),
];
