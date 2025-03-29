<?php
$API_KEY = "zM187Hd6ugKdXYM-96vBk5z8-5eE3CeMN-m798V6vU-HQ3PAaG7X7a4d9T";
$BASE_URL = "https://onlinesim.io/api";
$HISTORY_FILE = 'history.json';

function loadNumbers($file) {
    if (file_exists($file)) {
        $data = file_get_contents($file);
        return json_decode($data, true) ?: [];
    }
    return [];
}

function appendToHistory($number) {
    global $HISTORY_FILE;
    $history = loadNumbers($HISTORY_FILE);
    
    $number['sms_list'] = isset($number['sms_list']) && !empty($number['sms_list']) ? $number['sms_list'] : ['Нет SMS'];
    $number['closed_at'] = time();
    
    array_unshift($history, $number);
    file_put_contents($HISTORY_FILE, json_encode($history, JSON_PRETTY_PRINT));
}

function fetchFromApi($url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($response === false || $httpCode !== 200) {
        error_log("Ошибка запроса к Online SIM: URL=$url, HTTP_CODE=$httpCode, ERROR=$error, RESPONSE=" . ($response ?: 'нет ответа'));
        return false;
    }
    error_log("Успешный запрос: URL=$url, RESPONSE=$response");
    return $response;
}

if (isset($_GET['action'])) {
    $action = $_GET['action'];

    if ($action === 'balance') {
        $response = fetchFromApi("$BASE_URL/getBalance.php?apikey=$API_KEY");
        $data = json_decode($response, true);
        echo $data && isset($data['balance']) ? "ACCESS_BALANCE:{$data['balance']}" : "ERROR_SERVER";
    } elseif ($action === 'getNumber' && isset($_GET['country']) && isset($_GET['service'])) {
        $country = $_GET['country'];
        $service = $_GET['service'];
        error_log("Запрос номера: страна=$country, сервис=$service");

        $statsResponse = fetchFromApi("$BASE_URL/getNumbersStats.php?apikey=$API_KEY&country=$country");
        $statsData = json_decode($statsResponse, true);
        if (!$statsData) {
            error_log("Ошибка getNumbersStats: нет ответа для страны $country");
            echo "ERROR_SERVER";
            exit;
        }
        error_log("Ответ getNumbersStats для страны $country: " . json_encode($statsData['services']));

        $serviceFound = false;
        foreach ($statsData['services'] as $key => $serviceData) {
            if ($serviceData['slug'] === $service) {
                $serviceFound = true;
                if ($serviceData['count'] == 0) {
                    error_log("Нет доступных номеров для сервиса $service в стране $country");
                    echo "ERROR_NO_NUMBERS";
                    exit;
                }
                break;
            }
        }
        if (!$serviceFound) {
            error_log("Сервис $service не найден для страны $country в Online SIM");
            echo "ERROR_NO_SERVICE";
            exit;
        }

        $response = fetchFromApi("$BASE_URL/getNum.php?apikey=$API_KEY&service=$service&country=$country&number=true");
        $data = json_decode($response, true);
        if ($data && isset($data['tzid'])) {
            $stateResponse = fetchFromApi("$BASE_URL/getState.php?apikey=$API_KEY&tzid={$data['tzid']}");
            $stateData = json_decode($stateResponse, true);
            $phone = $stateData[0]['number'] ?? 'Неизвестно';
            $price = $stateData[0]['sum'] ?? 'Неизвестно';
            echo "ACCESS_NUMBER:{$data['tzid']}:$phone";
        } else {
            error_log("Ошибка getNum для сервиса $service в стране $country: " . $response);
            echo $response !== false ? ($data['response'] ?? "ERROR_SERVER") : "ERROR_SERVER";
        }
    } elseif ($action === 'getMessage' && isset($_GET['id'])) {
        $id = $_GET['id'];
        $response = fetchFromApi("$BASE_URL/getState.php?apikey=$API_KEY&tzid=$id&message_to_code=1");
        $data = json_decode($response, true);
        if ($data && isset($data[0])) {
            $state = $data[0];
            error_log("getMessage для ID $id: msg=" . json_encode($state['msg']));
            if ($state['response'] === 'TZ_NUM_ANSWER' && $state['msg']) {
                echo "STATUS_OK:{$state['msg']}";
            } elseif ($state['response'] === 'TZ_NUM_WAIT') {
                echo "STATUS_WAIT_CODE";
            } else {
                echo "STATUS_CANCEL";
            }
        } else {
            echo "ERROR_SERVER";
        }
    } elseif ($action === 'getPrices' && isset($_GET['country']) && isset($_GET['service'])) {
        $country = $_GET['country'];
        $service = $_GET['service'];
        $response = fetchFromApi("$BASE_URL/getNumbersStats.php?apikey=$API_KEY&country=$country");
        $data = json_decode($response, true);
        error_log("getPrices raw response: " . json_encode($data)); // Полный ответ API
        if ($data && isset($data['services'])) {
            $serviceData = null;
            foreach ($data['services'] as $key => $svc) {
                if ($svc['slug'] === $service) {
                    $serviceData = $svc;
                    break;
                }
            }
            if ($serviceData) {
                $price = isset($serviceData['price']) ? (string)$serviceData['price'] : '0'; // Явно приводим к строке
                $count = $serviceData['count'] ?? 0;
                $prices = [$price => $count];
                error_log("getPrices: страна=$country, сервис=$service, цена=$price, count=$count");
                error_log("getPrices encoded response: " . json_encode([$country => [$service => $prices]]));
                echo json_encode([$country => [$service => $prices]]);
            } else {
                error_log("getPrices: сервис $service не найден в данных для страны $country");
                echo json_encode([]);
            }
        } else {
            error_log("getPrices: нет данных или неверный формат от API для страны $country");
            echo json_encode([]);
        }
    } elseif ($action === 'getActiveNumbers') {
        $response = fetchFromApi("$BASE_URL/getState.php?apikey=$API_KEY&msg_list=1&message_to_code=1");
        $data = json_decode($response, true);
        if ($data && is_array($data)) {
            $activeNumbers = array_map(function($item) {
                error_log("getActiveNumbers: msg для tzid={$item['tzid']}=" . json_encode($item['msg']));
                $smsList = [];
                if (isset($item['msg'])) {
                    if (is_string($item['msg'])) {
                        $smsList = [$item['msg']];
                    } elseif (is_array($item['msg'])) {
                        $smsList = array_map(function($msg) {
                            return is_string($msg) ? $msg : (isset($msg['msg']) ? $msg['msg'] : json_encode($msg));
                        }, $item['msg']);
                    }
                }
                return [
                    'id' => $item['tzid'],
                    'phone' => $item['number'],
                    'timestamp' => time() - (1200 - $item['time']),
                    'service' => $item['service'],
                    'sms_list' => $smsList,
                    'price' => $item['sum']
                ];
            }, $data);
            error_log("Возвращены активные номера: " . json_encode($activeNumbers));
            echo json_encode($activeNumbers);
        } else {
            echo json_encode([]);
        }
    } elseif ($action === 'getHistory') {
        $history = loadNumbers($HISTORY_FILE);
        echo json_encode($history);
    } elseif ($action === 'closeNumber' && isset($_GET['id'])) {
        $id = $_GET['id'];
        $price = isset($_GET['price']) ? $_GET['price'] : 'Неизвестно';
        $stateResponse = fetchFromApi("$BASE_URL/getState.php?apikey=$API_KEY&tzid=$id");
        $stateData = json_decode($stateResponse, true);
        $number = $stateData[0] ?? null;
        if ($number) {
            $response = fetchFromApi("$BASE_URL/setOperationOk.php?apikey=$API_KEY&tzid=$id");
            $data = json_decode($response, true);
            if ($data && $data['response'] === 1) {
                appendToHistory([
                    'id' => $id,
                    'phone' => $number['number'],
                    'timestamp' => time() - (1200 - $number['time']),
                    'service' => $number['service'],
                    'sms_list' => $number['msg'] ? (is_array($number['msg']) ? $number['msg'] : [$number['msg']]) : [],
                    'price' => $price
                ]);
                echo "NUMBER_CLOSED";
            } else {
                echo "ERROR_SERVER";
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