<?php
$API_KEY = "70570U5cb897728a8f6b43df99e89f827b2f18"; // Ваш ключ
$BASE_URL = "https://smshub.org/stubs/handler_api.php";
$NUMBERS_FILE = 'numbers.json';
$HISTORY_FILE = 'history.json';

function loadNumbers($file) {
    if (file_exists($file)) {
        $data = file_get_contents($file);
        return json_decode($data, true) ?: [];
    }
    return [];
}

function saveNumbers($numbers) {
    global $NUMBERS_FILE, $BASE_URL, $API_KEY;
    $currentTime = time();

    $activeNumbers = [];
    foreach ($numbers as $num) {
        if (($currentTime - $num['timestamp']) < 1200) {
            $status = file_get_contents("$BASE_URL?api_key=$API_KEY&action=getStatus&id=" . $num['id']);
            if ($status !== false && $status !== 'STATUS_CANCEL') {
                $activeNumbers[] = $num;
            } else {
                error_log("Удален номер из numbers.json: ID " . $num['id'] . " со статусом " . $status);
                appendToHistory($num);
            }
        } else {
            error_log("Удален номер из numbers.json по таймауту: ID " . $num['id']);
            appendToHistory($num);
        }
    }

    file_put_contents($NUMBERS_FILE, json_encode(array_values($activeNumbers)));
    return $activeNumbers;
}

function appendToHistory($number) {
    global $HISTORY_FILE;
    $history = loadNumbers($HISTORY_FILE);
    
    $number['sms_list'] = isset($number['sms_list']) && !empty($number['sms_list']) ? $number['sms_list'] : ['Нет SMS'];
    $number['closed_at'] = time();
    
    array_unshift($history, $number);
    file_put_contents($HISTORY_FILE, json_encode($history));
}

function fetchFromApi($url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10); // Таймаут 10 секунд
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($response === false || $httpCode !== 200) {
        error_log("Ошибка запроса к SMS Hub: URL=$url, HTTP_CODE=$httpCode, ERROR=$error, RESPONSE=" . ($response ?: 'нет ответа'));
        return false;
    }
    return $response;
}

if (isset($_GET['action'])) {
    $action = $_GET['action'];

    if ($action === 'balance') {
        $response = fetchFromApi("$BASE_URL?api_key=$API_KEY&action=getBalance");
        echo $response !== false ? $response : "ERROR_SERVER";
    } elseif ($action === 'getNumber' && isset($_GET['country']) && isset($_GET['service'])) {
        $country = $_GET['country'];
        $service = $_GET['service'];
        $maxPrice = isset($_GET['maxPrice']) ? $_GET['maxPrice'] : '';
        $url = "$BASE_URL?api_key=$API_KEY&action=getNumber&service=$service&country=$country";
        if ($maxPrice !== '') {
            $url .= "&maxPrice=$maxPrice";
        }
        $response = fetchFromApi($url);
        if ($response !== false && strpos($response, 'ACCESS_NUMBER') === 0) {
            $parts = explode(':', $response);
            if (count($parts) >= 3) {
                $numbers = loadNumbers($NUMBERS_FILE);
                $numbers[] = [
                    'id' => $parts[1],
                    'phone' => $parts[2],
                    'timestamp' => time(),
                    'service' => $service,
                    'sms_list' => [],
                    'price' => $maxPrice // Сохраняем цену при покупке
                ];
                saveNumbers($numbers);
                error_log("Успешно куплен номер: ID=" . $parts[1] . ", Phone=" . $parts[2] . ", Price=$maxPrice");
            }
            echo $response;
        } else {
            // Если ошибка сервера, логируем и возвращаем ответ, если он есть
            echo $response !== false ? $response : "ERROR_SERVER";
        }
    } elseif ($action === 'getMessage' && isset($_GET['id'])) {
        $id = $_GET['id'];
        $response = fetchFromApi("$BASE_URL?api_key=$API_KEY&action=getStatus&id=$id");
        if ($response !== false) {
            if (strpos($response, 'STATUS_OK') === 0) {
                $numbers = loadNumbers($NUMBERS_FILE);
                foreach ($numbers as &$num) {
                    if ($num['id'] === $id) {
                        if (!isset($num['sms_list'])) {
                            $num['sms_list'] = [];
                        }
                        $smsCode = explode(':', $response)[1];
                        if (!in_array($smsCode, $num['sms_list'])) {
                            $num['sms_list'][] = $smsCode;
                        }
                        break;
                    }
                }
                saveNumbers($numbers);
            }
            echo $response;
        } else {
            echo "ERROR_SERVER";
        }
    } elseif ($action === 'getPrices' && isset($_GET['country']) && isset($_GET['service'])) {
        $country = $_GET['country'];
        $service = $_GET['service'];
        $response = fetchFromApi("$BASE_URL?api_key=$API_KEY&action=getPrices&service=$service&country=$country");
        echo $response !== false ? $response : "ERROR_SERVER";
    } elseif ($action === 'getActiveNumbers') {
        $numbers = saveNumbers(loadNumbers($NUMBERS_FILE));
        echo json_encode($numbers);
    } elseif ($action === 'getHistory') {
        $history = loadNumbers($HISTORY_FILE);
        echo json_encode($history);
    } elseif ($action === 'requestAnotherSMS' && isset($_GET['id'])) {
        $id = $_GET['id'];
        $numbers = loadNumbers($NUMBERS_FILE);
        $number = array_filter($numbers, function($num) use ($id) { return $num['id'] === $id; });
        if (!empty($number)) {
            $number = array_values($number)[0];
            $service = $number['service'];
            $response = fetchFromApi("$BASE_URL?api_key=$API_KEY&action=setStatus&status=3&id=$id&service=$service");
            echo $response !== false ? $response : "ERROR_SERVER";
        } else {
            echo "NUMBER_NOT_FOUND";
        }
    } elseif ($action === 'completeActivation' && isset($_GET['id'])) {
        $id = $_GET['id'];
        $price = isset($_GET['price']) ? $_GET['price'] : 'Неизвестно';
        $numbers = loadNumbers($NUMBERS_FILE);
        $number = array_filter($numbers, function($num) use ($id) { return $num['id'] === $id; });
        if (!empty($number)) {
            $number = array_values($number)[0];
            $service = $number['service'];
            $response = fetchFromApi("$BASE_URL?api_key=$API_KEY&action=setStatus&status=6&id=$id&service=$service");
            if ($response !== false && $response === 'ACCESS_ACTIVATION') {
                $numbers = array_filter($numbers, function($num) use ($id) { return $num['id'] !== $id; });
                $number['price'] = $price; // Добавляем цену перед сохранением
                appendToHistory($number);
                saveNumbers($numbers);
            }
            echo $response !== false ? $response : "ERROR_SERVER";
        } else {
            echo "NUMBER_NOT_FOUND";
        }
    } elseif ($action === 'closeNumber' && isset($_GET['id'])) {
        $id = $_GET['id'];
        $price = isset($_GET['price']) ? $_GET['price'] : 'Неизвестно';
        $numbers = loadNumbers($NUMBERS_FILE);
        $number = array_filter($numbers, function($num) use ($id) { return $num['id'] === $id; });
        if (!empty($number)) {
            $number = array_values($number)[0];
            $service = $number['service'];
            $response = fetchFromApi("$BASE_URL?api_key=$API_KEY&action=setStatus&status=8&id=$id&service=$service");
            if ($response !== false && $response === 'ACCESS_CANCEL') {
                $numbers = array_filter($numbers, function($num) use ($id) { return $num['id'] !== $id; });
                $number['price'] = $price; // Добавляем цену перед сохранением
                appendToHistory($number);
                saveNumbers($numbers);
                echo "NUMBER_CLOSED";
            } else {
                echo $response !== false ? $response : "ERROR_SERVER";
            }
        } else {
            echo "NUMBER_NOT_FOUND";
        }
    } else {
        echo "Неверный запрос";
    }
    exit;
}
?>
