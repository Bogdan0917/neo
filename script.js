(function() {
    console.log('Начало загрузки script.js');

    const API_URL = window.currentApiUrl || 'api.php';
    let currentRequestId = null;
    let autoFetchInterval = null;
    let activeNumbers = [];
    let currentHistoryPage = 1;
    const itemsPerPage = 10;

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs < 10 ? '0' + secs : secs}`;
    }

  function formatPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, ''); // Убираем все нечисловые символы
    if (cleaned.length >= 10) {
        const countryCodeFirstTwo = cleaned.slice(0, 2);
        const countryCodeFirstThree = cleaned.slice(0, 3);

        // Румыния (+40)
        if (countryCodeFirstTwo === '40' && cleaned.length >= 11) {
            const fullCountryCode = cleaned.slice(0, 2);
            const part1 = cleaned.slice(2, 5);
            const part2 = cleaned.slice(5, 8);
            const part3 = cleaned.slice(8, 11);
            return `+${fullCountryCode}-${part1}-${part2}-${part3}`; // +40-XXX-XXX-XXX
        } 
        // Великобритания (+44)
        else if (countryCodeFirstTwo === '44' && cleaned.length >= 12) {
            const fullCountryCode = cleaned.slice(0, 2); // 44
            const operatorCode = cleaned.slice(2, 6);    // 7911
            const subscriberNumber = cleaned.slice(6, 12); // 123456
            return `+${fullCountryCode}-${operatorCode}-${subscriberNumber}`; // +44-7911-123456
        }
        // Чехия (+420) и Словакия (+421)
        else if ((countryCodeFirstThree === '420' || countryCodeFirstThree === '421') && cleaned.length >= 12) {
            const fullCountryCode = cleaned.slice(0, 3);
            const part1 = cleaned.slice(3, 6);
            const part2 = cleaned.slice(6, 9);
            const part3 = cleaned.slice(9, 12);
            return `+${fullCountryCode}-${part1}-${part2}-${part3}`; // +420-XXX-XXX-XXX или +421-XXX-XXX-XXX
        }
        // Украина (+380)
        else if (countryCodeFirstThree === '380' && cleaned.length >= 12) {
            const fullCountryCode = cleaned.slice(0, 3); // 380
            const operatorCode = cleaned.slice(3, 5);    // 67
            const part1 = cleaned.slice(5, 8);           // 577
            const part2 = cleaned.slice(8, 10);          // 09
            const part3 = cleaned.slice(10, 12);         // 18
            return `+${fullCountryCode}-${operatorCode}-${part1}-${part2}-${part3}`; // +380-67-577-09-18
        }
        // Другие страны (+XXX), включая Грузию (+995)
        else if (cleaned.length >= 12) {
            const countryCode = cleaned.slice(0, 3);
            const part1 = cleaned.slice(3, 6);
            const part2 = cleaned.slice(6, 9);
            const part3 = cleaned.slice(9, 12);
            return `+${countryCode}-${part1}-${part2}-${part3}`; // +995-XXX-XXX-XXX
        }
        // Для номеров длиной 11 цифр (если такие будут)
        else if (cleaned.length >= 11) {
            const countryCode = cleaned.slice(0, 3);
            const part1 = cleaned.slice(3, 6);
            const part2 = cleaned.slice(6, 9);
            const part3 = cleaned.slice(9, 11);
            return `+${countryCode}-${part1}-${part2}-${part3}`; // +XXX-XXX-XXX-XX
        }
    }
    return phone; // Если номер не подходит, возвращаем как есть
}

    function formatTimestamp(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
    }

    function getServiceIcon(service) {
        const icons = {
            'tx': 'https://consumersiteimages.trustpilot.net/business-units/5c91fc8026dc22000182a60e-198x149-2x.avif',
            'aq': 'https://play-lh.googleusercontent.com/mRps2d2y5MSkzR6qC3YToZWqU3Hr-qg0VNJ0Bu8aT3qLllwcGqAbPV3uymxd05LPbXQ',
            'abe': 'https://play-lh.googleusercontent.com/v5ikywKFSu_03hxZ3fjx-RZT16DU6l7_F--bNrXwIzvK_Hvp3drYtyjFk8xKVzn8W9-u',
            'ayn': 'https://downloadr2.apkmirror.com/wp-content/uploads/2018/07/5b3b12110b190-384x384.png',
            'ot': 'https://cdn-icons-png.flaticon.com/512/5705/5705272.png'
        };
        return icons[service] || 'images/default.png';
    }

    function getServiceName(service) {
        const names = {
            'tx': 'Bolt',
            'aq': 'Glovo',
            'abe': 'Foodora',
            'ayn': 'Lime',
            'ot': 'Любой другой'
        };
        return names[service] || service;
    }

function displayNumbers() {
    const numberDiv = document.getElementById('number');
    const container = document.querySelector('.container');
    console.log('Текущие активные номера:', activeNumbers);
    if (numberDiv && container) {
        if (activeNumbers.length > 0) {
            const currentTime = Math.floor(Date.now() / 1000);
            numberDiv.innerHTML = activeNumbers.map(num => {
                const timeLeft = 1200 - (currentTime - num.timestamp);
                const formattedPhone = formatPhoneNumber(num.phone);
                const serviceIcon = getServiceIcon(num.service);
                const serviceName = getServiceName(num.service);
                const smsList = num.sms_list && num.sms_list.length > 0 ? num.sms_list.join(', ') : 'Ожидание...';
                console.log(`Отображаем номер ${num.id} с SMS: ${smsList}`);

                // Определяем код страны из номера
                const countryCode = num.phone.slice(0, 3); // Берём первые 3 цифры (например, 421, 380)
                const flagUrl = getCountryFlag(countryCode); // Получаем URL флага

                return `
                    <div class="number-item" id="number-item-${num.id}">
                        <div class="header">
                            <span class="service"><img src="${serviceIcon}" alt="${serviceName}" class="service-icon"> ${serviceName}</span>
                            <!-- НОВОЕ: Таймер и крестик в правом углу -->
                            <div class="right-header">
                                <span class="timer" id="timer_${num.id}">${formatTime(timeLeft)}</span>
                                <a href="#" class="close-icon" onclick="closeNumber('${num.id}'); return false;">
                                    <img src="https://img.icons8.com/?size=100&id=T9nkeADgD3z6&format=png&color=000000" alt="Закрыть">
                                </a>
                            </div>
                        </div>
                        <div class="flag-container">
                            <img src="${flagUrl}" alt="Flag" class="country-flag">
                        </div>
                        <div class="phone-line">
                            <span class="bold-phone">${formattedPhone}</span>
                        </div>
                        <div class="sms-line">SMS: <span id="sms_${num.id}" class="sms-code">${smsList}</span></div>
                    </div>
                `;
            }).join('');
            container.classList.add('expanded');
        } else {
            numberDiv.innerHTML = 'Нет активных номеров';
            document.getElementById('message').innerHTML = '';
            container.classList.remove('expanded');
        }
        updateTimers();
    } else {
        console.error('Элемент number или container не найден');
    }
}

function getCountryFlag(countryCode) {
    const flagMap = {
        '407': 'https://flagcdn.com/w80/ro.png',   // Румыния
        '447': 'https://flagcdn.com/w80/gb.png',   // Румыния
        '995': 'https://flagcdn.com/w80/ge.png',   // Грузия
        '420': 'https://flagcdn.com/w80/cz.png',  // Чехия
        '421': 'https://flagcdn.com/w80/sk.png',  // Словакия
        '380': 'https://flagcdn.com/w80/ua.png',  // Украина
        '370': 'https://flagcdn.com/w80/lt.png',  // Литва
        '371': 'https://flagcdn.com/w80/lv.png',  // Латвия
        '372': 'https://flagcdn.com/w80/ee.png',  // Эстония
        'default': 'https://flagcdn.com/w20/xx.png' // Заглушка для неизвестных стран
    };
    return flagMap[countryCode] || flagMap['default'];
}

    function updateTimers() {
        const currentTime = Math.floor(Date.now() / 1000);
        activeNumbers.forEach(num => {
            const timeLeft = 1200 - (currentTime - num.timestamp);
            const timerElement = document.getElementById(`timer_${num.id}`);
            if (timerElement) {
                timerElement.textContent = formatTime(timeLeft > 0 ? timeLeft : 0);
            }
        });
        if (activeNumbers.length > 0) {
            setTimeout(updateTimers, 1000);
        }
    }

    async function loadActiveNumbers(scrollToNew = false) {
        try {
            const response = await fetch(`${API_URL}?action=getActiveNumbers`);
            if (!response.ok) throw new Error('Сетевой сбой: ' + response.status);
            const data = await response.json();
            activeNumbers = data;
            displayNumbers();
            if (scrollToNew && activeNumbers.length > 0) {
                const newNumberElement = document.getElementById(`number-item-${currentRequestId}`);
                if (newNumberElement) {
                    newNumberElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
            if (activeNumbers.length > 0) {
                currentRequestId = activeNumbers[activeNumbers.length - 1].id;
                if (!autoFetchInterval) startAutoFetchSMS();
            } else {
                currentRequestId = null;
                if (autoFetchInterval) {
                    clearInterval(autoFetchInterval);
                    autoFetchInterval = null;
                }
            }
        } catch (error) {
            document.getElementById('error').innerHTML = 'Ошибка загрузки номеров: ' + error.message;
            displayNumbers();
        }
    }

    async function getBalance() {
        try {
            const response = await fetch(`${API_URL}?action=balance`);
            if (!response.ok) throw new Error('Сетевой сбой: ' + response.status);
            const data = await response.text();
            if (data.includes('ERROR')) {
                document.getElementById('balance').innerText = 'Ошибка при получении баланса';
            } else {
                const balanceValue = data.split(':')[1];
                document.getElementById('balance').innerText = `Баланс: ${balanceValue} $`;
            }
        } catch (error) {
            document.getElementById('balance').innerText = 'Ошибка: ' + error.message;
        }
    }

    async function updatePrices() {
        const country = document.getElementById('country').value;
        const service = document.getElementById('service').value;
        const maxPriceSelect = document.getElementById('maxPrice');
        if (maxPriceSelect) {
            maxPriceSelect.innerHTML = '<option value="">Загрузка цен...</option>';
            try {
                const response = await fetch(`${API_URL}?action=getPrices&country=${country}&service=${service}`);
                if (!response.ok) throw new Error('Сетевой сбой: ' + response.status);
                const data = await response.json();
                maxPriceSelect.innerHTML = '';
                if (data && data[country] && data[country][service]) {
                    const prices = data[country][service];
                    for (let price in prices) {
                        const option = document.createElement('option');
                        option.value = price;
                        option.text = `${price} $ (${prices[price]} номеров)`;
                        maxPriceSelect.appendChild(option);
                    }
                } else {
                    maxPriceSelect.innerHTML = '<option value="">Нет доступных цен</option>';
                }
            } catch (error) {
                maxPriceSelect.innerHTML = '<option value="">Ошибка: ' + error.message;
            }
        }
    }

    async function getNumber() {
    const country = document.getElementById('country').value;
    const service = document.getElementById('service').value;
    const maxPrice = document.getElementById('maxPrice').value;
    const errorDiv = document.getElementById('error');
    if (errorDiv) errorDiv.innerHTML = '';

    try {
        console.log('Покупка нового номера...');
        console.log('Параметры:', { country, service, maxPrice });
        const response = await fetch(`${window.currentApiUrl}?action=getNumber&country=${country}&service=${service}&maxPrice=${maxPrice}`);
        if (!response.ok) throw new Error('Сетевой сбой: ' + response.status);
        const data = await response.text();
        console.log('Ответ getNumber:', data);

        if (data.startsWith('ACCESS_NUMBER')) {
            const parts = data.split(':');
            console.log('Разделенный ответ:', parts);
            if (parts.length < 3) throw new Error('Неверный формат ответа от API');
            currentRequestId = parts[1];
            console.log('Новый номер куплен:', currentRequestId);
            await loadActiveNumbers(true);
            // Сохраняем цену в activeNumbers
            const num = activeNumbers.find(n => n.id === currentRequestId);
            if (num) {
                num.price = maxPrice;
                console.log(`Цена для номера ${currentRequestId} сохранена: ${maxPrice} $`);
            }
            if (!autoFetchInterval) startAutoFetchSMS();

            // Плавная прокрутка к низу контейнера .number
            const numberDiv = document.getElementById('number');
            if (numberDiv) {
                numberDiv.scrollTo({
                    top: numberDiv.scrollHeight,
                    behavior: 'smooth'
                });
            }
        } else if (data === 'NO_NUMBERS') {
            errorDiv.innerHTML = 'Нет доступных номеров для выбранных параметров';
            console.log('Нет номеров');
        } else if (data.includes('ERROR')) {
            errorDiv.innerHTML = 'Ошибка API: ' + data;
            console.log('Ошибка API:', data);
        } else {
            errorDiv.innerHTML = 'Неизвестный ответ от API: ' + data;
            console.log('Неизвестный ответ:', data);
        }
    } catch (error) {
        errorDiv.innerHTML = 'Ошибка покупки: ' + error.message;
        console.error('Ошибка покупки:', error);
    }
}

   async function checkSMS(id) {
    try {
        console.log('Проверка статуса для ID:', id);
        const response = await fetch(`${window.currentApiUrl}?action=getMessage&id=${id}`);
        if (!response.ok) throw new Error('Сетевой сбой: ' + response.status);
        const data = await response.text();
        console.log('Ответ getStatus для', id, ':', data);

        const smsElement = document.getElementById(`sms_${id}`);
        if (smsElement) {
            smsElement.className = 'sms-code';
            const num = activeNumbers.find(n => n.id === id);
            if (!num.sms_list) num.sms_list = []; // Инициализируем массив SMS, если его нет

            if (data.startsWith('STATUS_OK')) {
                const newSms = data.split(':')[1];
                if (!num.sms_list.includes(newSms)) {
                    num.sms_list.push(newSms); // Добавляем новый SMS в массив
                    console.log(`SMS для ${id} добавлен: ${newSms}`);
                    smsElement.textContent = num.sms_list.join(', '); // Обновляем отображение сразу

                    // Если это первый SMS, ждём 2 секунды и запрашиваем ещё один
                    if (num.sms_list.length === 1) {
                        console.log(`Первый SMS получен для ${id}, ждём 2 секунды перед запросом ещё одного...`);
                        setTimeout(async () => {
                            await requestAnotherSMS(id);
                        }, 2000); // Задержка 2 секунды
                    }
                }
            } else if (data === 'STATUS_WAIT_CODE' && num.sms_list.length === 0) {
                smsElement.textContent = 'Ожидание...'; // "Ожидание..." только если нет SMS
            } else if (data === 'STATUS_WAIT_RETRY' && num.sms_list.length === 0) {
                smsElement.textContent = 'Ожидание повторной отправки...'; // Только если нет SMS
            } else if (data === 'STATUS_CANCEL') {
                smsElement.textContent = 'Номер закрыт';
                activeNumbers = activeNumbers.filter(num => num.id !== id);
                displayNumbers();
                if (activeNumbers.length === 0) {
                    currentRequestId = null;
                    clearInterval(autoFetchInterval);
                    autoFetchInterval = null;
                    console.log('Все номера закрыты, интервал очищен');
                }
            } else if (num.sms_list.length > 0) {
                smsElement.textContent = num.sms_list.join(', '); // Сохраняем существующие SMS
            } else {
                smsElement.textContent = data; // Другие состояния, если нет SMS
            }
        } else {
            console.error(`Элемент sms_${id} не найден`);
        }
        return data;
    } catch (error) {
        document.getElementById('error').innerHTML = 'Ошибка проверки SMS: ' + error.message;
        console.error('Ошибка SMS:', error);
        return null;
    }
}

    async function requestAnotherSMS(id) {
        try {
            const response = await fetch(`${API_URL}?action=requestAnotherSMS&id=${id}`);
            if (!response.ok) throw new Error('Сетевой сбой: ' + response.status);
            const data = await response.text();
            if (data === 'ACCESS_RETRY' || data === 'ACCESS_RETRY_GET') {
                await checkSMS(id);
            } else if (data === 'BAD_ACTION') {
                document.getElementById('error').innerHTML = 'Нельзя запросить еще SMS на этом этапе';
            } else {
                document.getElementById('error').innerHTML = 'Ошибка запроса SMS: ' + data;
            }
        } catch (error) {
            document.getElementById('error').innerHTML = 'Ошибка запроса SMS: ' + error.message;
        }
    }

    // ... (остальной код остаётся без изменений до closeNumber)

async function closeNumber(id) {
    try {
        console.log('Закрытие номера ID:', id);
        const currentStatus = await checkSMS(id);
        console.log('Текущий статус номера перед закрытием:', currentStatus);

        if (currentStatus === 'STATUS_CANCEL') {
            console.log('Номер уже закрыт:', id);
            await loadActiveNumbers();
            return;
        }

        let response;
        const num = activeNumbers.find(n => n.id === id);
        const price = num && num.price ? num.price : 'Неизвестно';
        if (currentStatus && currentStatus.startsWith('STATUS_OK')) {
            console.log('Завершение активации для ID:', id);
            response = await fetch(`${window.currentApiUrl}?action=completeActivation&id=${id}&price=${price}`);
        } else {
            console.log('Прямое закрытие номера для ID:', id);
            response = await fetch(`${window.currentApiUrl}?action=closeNumber&id=${id}&price=${price}`);
        }

        if (!response.ok) throw new Error('Сетевой сбой: ' + response.status);
        const data = await response.text();
        console.log('Ответ на закрытие/завершение:', data);

        if (data === 'ACCESS_ACTIVATION' || data === 'ACCESS_CANCEL' || data === 'NUMBER_CLOSED') {
            console.log('Номер успешно закрыт:', id);
            const numberItem = document.getElementById(`number-item-${id}`);
            if (numberItem) {
                // Применяем плавную анимацию исчезновения
                numberItem.style.transition = 'opacity 0.5s ease';
                numberItem.style.opacity = '0';

                // Ждём завершения анимации и удаляем элемент
                setTimeout(() => {
                    numberItem.remove(); // Удаляем только этот элемент из DOM
                    activeNumbers = activeNumbers.filter(n => n.id !== id); // Обновляем массив
                    displayNumbers(); // Перерисовываем список

                    if (currentRequestId === id && activeNumbers.length > 0) {
                        currentRequestId = activeNumbers[activeNumbers.length - 1].id;
                        console.log('Обновлен currentRequestId:', currentRequestId);
                    } else if (activeNumbers.length === 0) {
                        currentRequestId = null;
                        clearInterval(autoFetchInterval);
                        autoFetchInterval = null;
                        console.log('Все номера закрыты, интервал очищен');
                    }
                }, 500); // Задержка соответствует длительности анимации (0.5s)
            } else {
                await loadActiveNumbers(); // Если элемента нет, просто обновляем
            }
        } else {
            document.getElementById('error').innerHTML = 'Ошибка закрытия номера: ' + data;
            console.log('Ошибка закрытия:', data);
        }
    } catch (error) {
        document.getElementById('error').innerHTML = 'Ошибка закрытия: ' + error.message;
        console.error('Ошибка закрытия:', error);
    }
}

// ... (остальной код остаётся без изменений)

    // ... (остальной код остаётся без изменений до showHistory)

async function showHistory(page = 1) {
    currentHistoryPage = page;

    const modal = document.getElementById('historyModal');
    const historyContent = document.getElementById('historyContent');
    if (!modal || !historyContent) {
        console.error('Элемент historyModal или historyContent не найден');
        return;
    }

    try {
        console.log('Загрузка истории...');
        const response = await fetch(`${window.currentApiUrl}?action=getHistory`);
        if (!response.ok) throw new Error('Сетевой сбой: ' + response.status);
        const history = await response.json();
        console.log('История:', history);

        // Убираем дубликаты по ID номера
        const uniqueHistory = Array.from(new Map(history.map(item => [item.id, item])).values());
        console.log('Уникальная история:', uniqueHistory);

        let filteredHistory = uniqueHistory;

        const totalItems = uniqueHistory.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;

        function renderHistory(historyArray) {
            const paginatedHistory = historyArray.slice(start, end);
            historyContent.innerHTML = paginatedHistory.length > 0 ? paginatedHistory.map(num => {
                const formattedPhone = formatPhoneNumber(num.phone);
                const serviceName = getServiceName(num.service);
                const closedAt = formatTimestamp(num.closed_at);
                const smsDisplay = num.sms_list ? num.sms_list.join(', ') : (num.last_sms || 'Нет SMS');
                const price = num.price !== undefined ? num.price : 'Неизвестно';
                return `
                    <div class="history-item">
                        <strong>Сервис:</strong> ${serviceName}<br>
                        <strong>Номер:</strong> ${formattedPhone} (ID: ${num.id})<br>
                        <strong>SMS:</strong> ${smsDisplay}<br>
                        <strong>Цена:</strong> ${price} $<br>
                        <strong>Закрыт:</strong> ${closedAt}
                    </div>
                `;
            }).join('<hr>') : 'История пуста или не найдено совпадений';

            historyContent.innerHTML += `
                <div class="pagination">
                    <button class="small-btn2" ${page === 1 ? 'disabled' : ''} onclick="showHistory(${page - 1})">Предыдущая</button>
                    <span>Страница ${page} из ${totalPages}</span>
                    <button class="small-btn2" ${page === totalPages ? 'disabled' : ''} onclick="showHistory(${page + 1})">Следующая</button>
                </div>
            `;
        }

        renderHistory(filteredHistory);

        document.getElementById('historySearch').addEventListener('input', function(e) {
            const query = e.target.value.toLowerCase();
            filteredHistory = uniqueHistory.filter(item => 
                item.phone.toLowerCase().includes(query)
            );
            const newTotalPages = Math.ceil(filteredHistory.length / itemsPerPage);
            currentHistoryPage = 1;
            const newStart = 0;
            const newEnd = itemsPerPage;
            renderHistory(filteredHistory.slice(newStart, newEnd));
            const pagination = historyContent.querySelector('.pagination');
            pagination.innerHTML = `
                <button class="small-btn2" ${currentHistoryPage === 1 ? 'disabled' : ''} onclick="showHistory(${currentHistoryPage - 1})">Предыдущая</button>
                <span>Страница ${currentHistoryPage} из ${newTotalPages}</span>
                <button class="small-btn2" ${currentHistoryPage === newTotalPages ? 'disabled' : ''} onclick="showHistory(${currentHistoryPage + 1})">Следующая</button>
            `;
        });

        // ИСПРАВЛЕНО: Устанавливаем display перед анимацией и добавляем класс show
        modal.style.display = 'block';
        setTimeout(() => {
            modal.classList.add('show');
        }, 10); // Небольшая задержка для корректного старта анимации
    } catch (error) {
        document.getElementById('error').innerHTML = 'Ошибка загрузки истории: ' + error.message;
        console.error('Ошибка загрузки истории:', error);
    }

    // ИСПРАВЛЕНО: Закрытие с анимацией
    document.getElementById('closeModal').onclick = function() {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300); // Задержка соответствует времени анимации (0.3s)
    };
}

// ... (остальной код остаётся без изменений)

    function closeHistoryModal() {
        const modal = document.getElementById('historyModal');
        if (modal) modal.style.display = 'none';
    }

    function startAutoFetchSMS() {
        if (autoFetchInterval) clearInterval(autoFetchInterval);
        autoFetchInterval = setInterval(async () => {
            for (const num of activeNumbers) {
                await checkSMS(num.id);
            }
        }, 1000);
        window.autoFetchInterval = autoFetchInterval;
    }

    function initializeProvider() {
        console.log('Инициализация SMSHub');
        getBalance();
        updatePrices();
        loadActiveNumbers();
        document.getElementById('getNumberBtn').addEventListener('click', getNumber);
        document.getElementById('country').addEventListener('change', updatePrices);
        document.getElementById('service').addEventListener('change', updatePrices);
        document.getElementById('historyIcon').addEventListener('click', () => showHistory(1));
        document.getElementById('closeModal').addEventListener('click', closeHistoryModal);
    }

    window.getNumber = getNumber;
    window.requestAnotherSMS = requestAnotherSMS;
    window.closeNumber = closeNumber;
    window.showHistory = showHistory;
    window.initializeProvider = initializeProvider;

    console.log('script.js полностью загружен, функции экспортированы');
})();