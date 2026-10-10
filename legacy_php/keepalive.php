<?php
session_start();
if (isset($_SESSION['user_id'])) {
    $_SESSION['last_activity'] = time();
    echo 'ok';
} else {
    echo 'no-session';
}
