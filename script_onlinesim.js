(function() {
    console.log('Начало загрузки script_onlinesim.js');

    const API_URL = window.currentApiUrl || 'api_onlinesim.php';
    let currentRequestId = null;
    let autoFetchInterval = null;
    let activeNumbers = [];

    const serviceMapping = {
        'tx': 'bolt',
        'aq': 'glovo',
        'abe': 'foodora',
        'ayn': 'lime',
        'ot': 'other'
    };

    const countryMapping = {
        '1': '380',  // Украина
        '6': '7',    // Россия
        '21': '48',  // Польша
        '0': '1'     // США
    };

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs < 10 ? '0' + secs : secs}`;
    }

    function formatPhoneNumber(phone) {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length >= 10) {
            const countryCodeFirstTwo = cleaned.slice(0, 2);
            const countryCodeFirstThree = cleaned.slice(0, 3);
            if (countryCodeFirstTwo === '40' && cleaned.length >= 11) {
                const fullCountryCode = cleaned.slice(0, 2);
                const part1 = cleaned.slice(2, 5);
                const part2 = cleaned.slice(5, 8);
                const part3 = cleaned.slice(8, 11);
                return `+${fullCountryCode}-${part1}-${part2}-${part3}`;
            } else if (countryCodeFirstTwo === '44' && cleaned.length >= 12) {
                const fullCountryCode = cleaned.slice(0, 2);
                const operatorCode = cleaned.slice(2, 6);
                const subscriberNumber = cleaned.slice(6, 12);
                return `+${fullCountryCode}-${operatorCode}-${subscriberNumber}`;
            } else if ((countryCodeFirstThree === '420' || countryCodeFirstThree === '421') && cleaned.length >= 12) {
                const fullCountryCode = cleaned.slice(0, 3);
                const part1 = cleaned.slice(3, 6);
                const part2 = cleaned.slice(6, 9);
                const part3 = cleaned.slice(9, 12);
                return `+${fullCountryCode}-${part1}-${part2}-${part3}`;
            } else if (countryCodeFirstThree === '380' && cleaned.length >= 12) {
                const fullCountryCode = cleaned.slice(0, 3);
                const operatorCode = cleaned.slice(3, 5);
                const part1 = cleaned.slice(5, 8);
                const part2 = cleaned.slice(8, 10);
                const part3 = cleaned.slice(10, 12);
                return `+${fullCountryCode}-${operatorCode}-${part1}-${part2}-${part3}`;
            } else if (cleaned.length >= 12) {
                const countryCode = cleaned.slice(0, 3);
                const part1 = cleaned.slice(3, 6);
                const part2 = cleaned.slice(6, 9);
                const part3 = cleaned.slice(9, 12);
                return `+${countryCode}-${part1}-${part2}-${part3}`;
            }
        }
        return phone;
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
        if (numberDiv && container) {
            if (activeNumbers.length > 0) {
                const currentTime = Math.floor(Date.now() / 1000);
                numberDiv.innerHTML = activeNumbers.map(num => {
                    const timeLeft = 1200 - (currentTime - num.timestamp);
                    const formattedPhone = formatPhoneNumber(num.phone);
                    const serviceIcon = getServiceIcon(Object.keys(serviceMapping).find(key => serviceMapping[key] === num.service) || num.service);
                    const serviceName = getServiceName(Object.keys(serviceMapping).find(key => serviceMapping[key] === num.service) || num.service);
                    const smsList = num.sms_list && num.sms_list.length > 0 ? num.sms_list.join(', ') : 'Ожидание...';
                    return `
                        <div class="number-item" id="number-item-${num.id}">
                            <div class="header">
                                <span class="service"><img src="${serviceIcon}" alt="${serviceName}" class="service-icon"> ${serviceName}</span>
                                <div class="right-header">
                                    <span class="timer" id="timer_${num.id}">${formatTime(timeLeft)}</span>
                                    <a href="#" class="close-icon" onclick="closeNumber('${num.id}'); return false;">
                                        <img src="https://img.icons8.com/?size=100&id=T9nkeADgD3z6&format=png&color=000000" alt="Закрыть">
                                    </a>
                                </div>
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
        }
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
            console.log('Активные номера:', data);
            activeNumbers = Array.isArray(data) ? data : [];
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
            console.error('Ошибка загрузки номеров:', error);
            document.getElementById('error').innerHTML = 'Ошибка загрузки номеров: ' + error.message;
            displayNumbers();
        }
    }

    async function getBalance() {
        try {
            const response = await fetch(`${API_URL}?action=balance`);
            if (!response.ok) throw new Error('Сетевой сбой: ' + response.status);
            const data = await response.text();
            console.log('Баланс:', data);
            if (data.includes('ERROR')) {
                document.getElementById('balance').innerText = 'Ошибка при получения баланса';
            } else {
                const balanceValue = data.split(':')[1];
                document.getElementById('balance').innerText = `Баланс: ${balanceValue} $`;
            }
        } catch (error) {
            console.error('Ошибка получения баланса:', error);
            document.getElementById('balance').innerText = 'Ошибка: ' + error.message;
        }
    }

    function toggleMaxPriceVisibility(show) {
        const maxPriceSelect = document.getElementById('maxPrice');
        const label = maxPriceSelect ? maxPriceSelect.parentElement.querySelector('label') : null;
        if (maxPriceSelect && label) {
            maxPriceSelect.style.display = show ? 'inline-block' : 'none';
            label.style.display = show ? 'inline-block' : 'none';
        }
    }

    async function updatePrices() {
    const country = document.getElementById('country').value;
    let service = document.getElementById('service').value;
    const mappedService = serviceMapping[service] || service;
    const mappedCountry = countryMapping[country] || country;
    const priceElement = document.getElementById('price');
    const errorDiv = document.getElementById('error');
    
    toggleMaxPriceVisibility(false);

    if (!priceElement) {
        console.error('Элемент с id="price" не найден в HTML');
        return;
    }

    try {
        const response = await fetch(`${API_URL}?action=getPrices&country=${mappedCountry}&service=${mappedService}`);
        if (!response.ok) throw new Error('Сетевой сбой: ' + response.status);
        const data = await response.json();
        console.log(`Доступность сервиса ${mappedService} для страны ${mappedCountry}:`, data);
        
        if (Object.keys(data).length === 0 || !data[mappedCountry] || !data[mappedCountry][mappedService]) {
            console.log('Цена недоступна для сервиса', mappedService, 'в стране', mappedCountry);
            priceElement.innerText = 'Н/Д';
            if (errorDiv) {
                errorDiv.style.color = 'red';
                errorDiv.innerHTML = `Сервис "${getServiceName(service)}" недоступен для страны ${mappedCountry}.`;
            }
        } else {
            const priceObj = data[mappedCountry][mappedService];
            const price = Object.keys(priceObj)[0];
            console.log('Извлеченная цена:', price, 'тип:', typeof price);
            const formattedPrice = parseFloat(price).toFixed(2);
            console.log('Отформатированная цена:', formattedPrice);
            priceElement.innerText = `${formattedPrice} $`;
            if (errorDiv) errorDiv.innerHTML = '';
        }
    } catch (error) {
        console.error('Ошибка проверки цен:', error);
        priceElement.innerText = 'Ошибка';
        if (errorDiv) errorDiv.innerHTML = 'Ошибка проверки доступности: ' + error.message;
    }
}

function initializeProvider() {
    console.log('Инициализация Online SIM');
    toggleMaxPriceVisibility(false);
    getBalance();
    updatePrices();
    loadActiveNumbers();
    document.getElementById('getNumberBtn').addEventListener('click', getNumber);
    document.getElementById('country').addEventListener('change', updatePrices);
    document.getElementById('service').addEventListener('change', updatePrices);
    document.getElementById('historyIcon').addEventListener('click', () => window.showHistory(1));
    document.getElementById('closeModal').addEventListener('click', () => document.getElementById('historyModal').style.display = 'none');
}

    async function getNumber() {
        let country = document.getElementById('country').value;
        let service = document.getElementById('service').value;
        const errorDiv = document.getElementById('error');
        if (errorDiv) errorDiv.innerHTML = '';

        const mappedService = serviceMapping[service] || service;
        const mappedCountry = countryMapping[country] || country;
        console.log(`Покупка номера: страна=${country} (преобразован в ${mappedCountry}), сервис=${service} (преобразован в ${mappedService})`);

        try {
            const response = await fetch(`${API_URL}?action=getNumber&country=${mappedCountry}&service=${mappedService}`);
            if (!response.ok) throw new Error('Сетевой сбой: ' + response.status);
            const data = await response.text();
            console.log('Ответ API:', data);

            if (data.startsWith('ACCESS_NUMBER')) {
                const parts = data.split(':');
                if (parts.length < 3) throw new Error('Неверный формат ответа от API');
                currentRequestId = parts[1];
                await loadActiveNumbers(true);
                if (!autoFetchInterval) startAutoFetchSMS();
            } else {
                let errorMessage = '';
                switch (data) {
                    case 'ERROR_NO_SERVICE':
                        errorMessage = `Сервис "${getServiceName(service)}" недоступен для страны с кодом ${mappedCountry}`;
                        break;
                    case 'ERROR_NO_NUMBERS':
                        errorMessage = `Нет доступных номеров для сервиса "${getServiceName(service)}" в стране ${mappedCountry}`;
                        break;
                    case 'ERROR_SERVER':
                        errorMessage = 'Ошибка сервера Online SIM. Попробуйте позже';
                        break;
                    default:
                        errorMessage = `Неизвестная ошибка API: ${data}`;
                }
                console.error(errorMessage);
                errorDiv.innerHTML = errorMessage;
            }
        } catch (error) {
            console.error('Ошибка покупки номера:', error);
            errorDiv.innerHTML = 'Ошибка покупки: ' + error.message;
        }
    }

    async function checkSMS(id) {
        try {
            const response = await fetch(`${API_URL}?action=getMessage&id=${id}`);
            if (!response.ok) throw new Error('Сетевой сбой: ' + response.status);
            const data = await response.text();
            console.log(`SMS для ID ${id}:`, data);
            const smsElement = document.getElementById(`sms_${id}`);
            if (smsElement) {
                smsElement.className = 'sms-code';
                const num = activeNumbers.find(n => n.id === id);
                if (!num.sms_list) num.sms_list = [];

                if (data.startsWith('STATUS_OK')) {
                    const newSms = data.split(':')[1];
                    if (!num.sms_list.includes(newSms)) {
                        num.sms_list.push(newSms);
                    }
                    smsElement.textContent = num.sms_list.join(', ');
                } else if (data === 'STATUS_WAIT_CODE' && num.sms_list.length === 0) {
                    smsElement.textContent = 'Ожидание...';
                } else if (data === 'STATUS_CANCEL') {
                    smsElement.textContent = 'Номер закрыт';
                    activeNumbers = activeNumbers.filter(num => num.id !== id);
                    displayNumbers();
                    if (activeNumbers.length === 0) {
                        currentRequestId = null;
                        clearInterval(autoFetchInterval);
                        autoFetchInterval = null;
                    }
                } else if (num.sms_list.length > 0) {
                    smsElement.textContent = num.sms_list.join(', ');
                } else {
                    smsElement.textContent = data;
                }
            }
            return data;
        } catch (error) {
            console.error('Ошибка проверки SMS:', error);
            document.getElementById('error').innerHTML = 'Ошибка проверки SMS: ' + error.message;
            return null;
        }
    }

    async function closeNumber(id) {
        try {
            const response = await fetch(`${API_URL}?action=closeNumber&id=${id}`);
            if (!response.ok) throw new Error('Сетевой сбой: ' + response.status);
            const data = await response.text();
            console.log(`Закрытие номера ${id}:`, data);
            if (data === 'NUMBER_CLOSED') {
                const numberItem = document.getElementById(`number-item-${id}`);
                if (numberItem) {
                    numberItem.style.transition = 'opacity 0.5s ease';
                    numberItem.style.opacity = '0';
                    setTimeout(() => {
                        numberItem.remove();
                        activeNumbers = activeNumbers.filter(n => n.id !== id);
                        displayNumbers();
                        if (activeNumbers.length === 0) {
                            currentRequestId = null;
                            clearInterval(autoFetchInterval);
                            autoFetchInterval = null;
                        }
                    }, 500);
                }
            } else {
                console.error('Ошибка закрытия номера:', data);
                document.getElementById('error').innerHTML = 'Ошибка закрытия номера: ' + data;
            }
        } catch (error) {
            console.error('Ошибка закрытия:', error);
            document.getElementById('error').innerHTML = 'Ошибка закрытия: ' + error.message;
        }
    }

    function startAutoFetchSMS() {
        if (autoFetchInterval) clearInterval(autoFetchInterval);
        autoFetchInterval = setInterval(async () => {
            if (activeNumbers.length > 0) {
                await loadActiveNumbers();
            }
        }, 10000);
        window.autoFetchInterval = autoFetchInterval;
    }

    function initializeProvider() {
        console.log('Инициализация Online SIM');
        toggleMaxPriceVisibility(false); // Скрываем maxPrice при старте Online SIM
        getBalance();
        updatePrices();
        loadActiveNumbers();
        document.getElementById('getNumberBtn').addEventListener('click', getNumber);
        document.getElementById('country').addEventListener('change', updatePrices);
        document.getElementById('service').addEventListener('change', updatePrices);
        document.getElementById('historyIcon').addEventListener('click', () => window.showHistory(1));
        document.getElementById('closeModal').addEventListener('click', () => document.getElementById('historyModal').style.display = 'none');
    }

    window.getNumber = getNumber;
    window.requestAnotherSMS = () => console.log('Online SIM не поддерживает повторный запрос SMS');
    window.closeNumber = closeNumber;
    window.showHistory = window.showHistory || function() { console.log('История не переопределена'); };
    window.initializeProvider = initializeProvider;

    console.log('script_onlinesim.js полностью загружен');
})();