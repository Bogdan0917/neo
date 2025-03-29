<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Прием одноразовых СМС</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css?v=<?php echo time(); ?>"> 
</head>
<body>
    <div class="container">
        <div class="balance-container">
            <div class="balance" id="balance">Баланс: загружается...</div>
            <div class="right-controls">
                <button class="small-btn" id="darkModeToggle">🌙</button>
                <img src="https://img.icons8.com/?size=100&id=86136&format=png&color=000000" alt="История" id="historyIcon" class="history-icon">
            </div>
        </div>
        <label><b></b></label>
        <div class="provider-switcher">
        <label><b>Выберите провайдера:</b></label>
            <select id="provider">
                <option value="smshub" selected>SMSHub</option>
                <option value="onlinesim">Online SIM</option>
            </select>
        </div>

        <div class="select-row">
            <div class="select-group">
                <label for="country">Страна:</label>
                <select id="country">
                    <option value="49">Латвия🇱🇻</option>
                    <option value="34">Эстония🇪🇪</option>
                    <option value="32">Румыния🇷🇴</option>
                    <option value="128">Грузия🇬🇪</option>
                    <option value="44">Литва🇱🇹</option>
                    <option value="1">Украина🇺🇦</option>
                    <option value="63">Чехия🇨🇿</option>
                    <option value="141">Словакия🇸🇰</option>
                    <option value="16">Англия🇬🇧</option>
                </select>
            </div>
            <div class="select-group">
                <label for="service">Сервис:</label>
                <select id="service">
                    <option value="tx">Bolt</option>
                    <option value="aq">Glovo</option>
                    <option value="abe">Foodora</option>
                    <option value="ayn">Lime</option>
                    <option value="ot">Любой другой</option>
                </select>
            </div>
        </div>

        <label>Цена за номер ($): <span id="price"></span></label>
        <select id="maxPrice"></select>

        <button id="getNumberBtn">Запросить номер</button>
        
        <div class="number" id="number">Нет активных номеров</div>
        
        <div class="error" id="error"></div>
        
        <div class="message" id="message"></div>
    </div>

    <div id="historyModal" class="modal">
        <div class="modal-content">
            <span id="closeModal" class="close">×</span>
            <h2>История SMS</h2>
            <input type="text" id="historySearch" placeholder="Поиск по номеру телефона..." class="search-input">
            <div id="historyContent"></div>
        </div>
    </div>

    <script>
        let currentProvider = 'smshub';

        function toggleMaxPriceVisibility(show) {
            const maxPriceSelect = document.getElementById('maxPrice');
            const maxPriceLabel = document.getElementById('maxPriceLabel');
            if (maxPriceSelect && maxPriceLabel) {
                maxPriceSelect.style.display = show ? 'inline-block' : 'none';
                maxPriceLabel.style.display = show ? 'inline-block' : 'none';
            }
        }

        function clearPreviousState() {
            const existingScript = document.getElementById('providerScript');
            if (existingScript) {
                existingScript.remove();
                console.log('Предыдущий скрипт удален');
            }

            window.smshub = undefined;
            window.onlinesim = undefined;
            window.currentApiUrl = null;
            window.getNumber = null;
            window.requestAnotherSMS = null;
            window.closeNumber = null;
            window.showHistory = null;
            window.initializeProvider = null;
            window.updatePrices = null;
            if (window.autoFetchInterval) {
                clearInterval(window.autoFetchInterval);
                window.autoFetchInterval = null;
                console.log('Интервал очищен');
            }

            document.getElementById('number').innerHTML = 'Нет активных номеров';
            document.getElementById('balance').innerText = 'Баланс: загружается...';
            document.getElementById('error').innerHTML = '';
            document.getElementById('message').innerHTML = '';
            document.getElementById('maxPrice').innerHTML = '';

            // Сохраняем текущее значение provider перед клонированием
            const providerSelect = document.getElementById('provider');
            const currentProviderValue = providerSelect ? providerSelect.value : currentProvider;

            const elementsToReset = [
                'getNumberBtn',
                'country',
                'service',
                'historyIcon',
                'closeModal',
                'provider' // Добавляем provider в список для клонирования
            ];
            elementsToReset.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    const newElement = element.cloneNode(true);
                    element.parentNode.replaceChild(newElement, element);
                }
            });

            // Восстанавливаем значение provider после клонирования
            const newProviderSelect = document.getElementById('provider');
            if (newProviderSelect) {
                newProviderSelect.value = currentProviderValue;
            }

            console.log('Состояние очищено');
            addSelectionListeners();
        }

        function loadProviderScript(provider) {
            clearPreviousState();

            const script = document.createElement('script');
            script.id = 'providerScript';
            const timestamp = new Date().getTime();
            script.src = provider === 'smshub' ? 
                `script.js?v=${timestamp}` : 
                `script_onlinesim.js?v=${timestamp}`;
            script.async = true;
            document.body.appendChild(script);
            console.log(`Загрузка скрипта для ${provider}: ${script.src}`);

            window.currentApiUrl = provider === 'smshub' ? 'api.php' : 'api_onlinesim.php';
            toggleMaxPriceVisibility(provider === 'smshub');

            script.onload = function() {
                console.log(`Скрипт для ${provider} успешно загружен`);
                setTimeout(() => {
                    if (typeof window.initializeProvider === 'function') {
                        // Восстанавливаем значения страны и сервиса из localStorage
                        const savedCountry = localStorage.getItem('selectedCountry');
                        const savedService = localStorage.getItem('selectedService');
                        const countrySelect = document.getElementById('country');
                        const serviceSelect = document.getElementById('service');

                        if (savedCountry && countrySelect.querySelector(`option[value="${savedCountry}"]`)) {
                            countrySelect.value = savedCountry;
                        }
                        if (savedService && serviceSelect.querySelector(`option[value="${savedService}"]`)) {
                            serviceSelect.value = savedService;
                        }

                        window.initializeProvider();
                        console.log(`Инициализация ${provider} выполнена`);
                    } else {
                        document.getElementById('error').innerHTML = 'Ошибка: Не удалось инициализировать провайдер';
                        console.error(`Функция initializeProvider не найдена для ${provider}`);
                    }
                }, 100);
            };

            script.onerror = function() {
                document.getElementById('error').innerHTML = 'Ошибка загрузки скрипта провайдера';
                console.error(`Не удалось загрузить скрипт для ${provider}`);
            };
        }

        function addSelectionListeners() {
            const countrySelect = document.getElementById('country');
            const serviceSelect = document.getElementById('service');
            const providerSelect = document.getElementById('provider');

            if (countrySelect) {
                countrySelect.addEventListener('change', function() {
                    localStorage.setItem('selectedCountry', this.value);
                    console.log('Сохранена страна:', this.value);
                    if (typeof window.updatePrices === 'function') window.updatePrices();
                });
            }

            if (serviceSelect) {
                serviceSelect.addEventListener('change', function() {
                    localStorage.setItem('selectedService', this.value);
                    console.log('Сохранён сервис:', this.value);
                    if (typeof window.updatePrices === 'function') window.updatePrices();
                });
            }

            if (providerSelect) {
                providerSelect.addEventListener('change', function(e) {
                    currentProvider = e.target.value;
                    console.log(`Переключение на провайдер: ${currentProvider}`);
                    loadProviderScript(currentProvider);
                });
            }
        }

        window.addEventListener('load', function() {
            console.log('Загрузка страницы, инициализация SMSHub');
            loadProviderScript('smshub');

            const startX = Math.floor(Math.random() * 101) + '%';
            const startY = Math.floor(Math.random() * 101) + '%';
            document.body.style.setProperty('--start-x', startX);
            document.body.style.setProperty('--start-y', startY);

            const darkMode = localStorage.getItem('darkMode');
            if (darkMode === 'enabled') {
                document.body.classList.add('dark-mode');
                document.getElementById('darkModeToggle').textContent = '☀️';
                document.getElementById('historyIcon').src = 'https://img.icons8.com/?size=100&id=86136&format=png&color=FFFFFF';
            }
        });

        document.getElementById('darkModeToggle').addEventListener('click', function() {
            document.body.classList.toggle('dark-mode');
            const isDarkMode = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');
            document.getElementById('darkModeToggle').textContent = isDarkMode ? '☀️' : '🌙';
            document.getElementById('historyIcon').src = isDarkMode ? 
                'https://img.icons8.com/?size=100&id=86136&format=png&color=FFFFFF' : 
                'https://img.icons8.com/?size=100&id=86136&format=png&color=000000';
        });
    </script>
    <script src="script.js?v=<?php echo time(); ?>" defer></script>
</body>
</html>