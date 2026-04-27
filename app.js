(function() {
    'use strict';

    // ---------- DOM-элементы ----------
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const messageEl = document.getElementById('message');
    const modeSelector = document.getElementById('modeSelector');
    const modeCirclesBtn = document.getElementById('modeCircles');
    const modeSchemeBtn = document.getElementById('modeScheme');
    const previewSection = document.getElementById('previewSection');
    const previewContainer = document.getElementById('previewContainer');
    const actions = document.getElementById('actions');
    const downloadBtn = document.getElementById('downloadBtn');
    const clearBtn = document.getElementById('clearBtn');
    const footerText = document.getElementById('footerText');

    // ---------- Состояние ----------
    let originalSVGText = '';
    let processedSVGText = '';
    let currentFileName = 'scheme';
    let activeMode = 'circles'; // 'circles' или 'scheme'

    // ---------- Вспомогательные функции ----------

    /** Показать сообщение */
    function showMessage(text, type = 'warning') {
        messageEl.textContent = text;
        messageEl.className = `message message--${type} visible`;
    }

    /** Скрыть сообщение */
    function hideMessage() {
        messageEl.className = 'message';
    }

    /** Показать интерфейс после загрузки */
    function showUI() {
        modeSelector.classList.add('visible');
        previewSection.classList.add('visible');
        actions.classList.add('visible');
    }

    /** Скрыть интерфейс */
    function hideUI() {
        modeSelector.classList.remove('visible');
        previewSection.classList.remove('visible');
        actions.classList.remove('visible');
        previewContainer.innerHTML = '';
        dropZone.classList.remove('file-loaded');
        footerText.textContent = 'Загрузите SVG-файл, чтобы начать обработку';
    }

    /** Переключение активного режима */
    function setActiveMode(mode) {
        activeMode = mode;
        if (mode === 'circles') {
            modeCirclesBtn.classList.add('mode-btn--active');
            modeSchemeBtn.classList.remove('mode-btn--active');
            footerText.textContent = 'Режим «Замена кругов»: группы Ряд_ заменяются на circle/ellipse';
        } else {
            modeSchemeBtn.classList.add('mode-btn--active');
            modeCirclesBtn.classList.remove('mode-btn--active');
            footerText.textContent = 'Режим «Преобразователь схемы»: исправление id рядов и мест';
        }
        // Перезапустить обработку с новым режимом
        if (originalSVGText) {
            processAndShow();
        }
    }

    /** Скачать файл */
    function downloadSVG(svgText, filename) {
        const blob = new Blob([svgText], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.endsWith('.svg') ? filename : filename + '.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /** Отобразить SVG в preview */
    function renderPreview(svgText) {
        previewContainer.innerHTML = svgText;
    }

    /** Склонение слова "ряд" */
    function pluralizeRows(count) {
        const mod10 = count % 10;
        const mod100 = count % 100;
        if (mod10 === 1 && mod100 !== 11) return 'ряд';
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'ряда';
        return 'рядов';
    }

    // ---------- Режим 1: Замена кругов ----------

    function hasRows(svgText) {
        return /<g[^>]*\bid\s*=\s*["']([^"']*Ряд_[^"']*)["'][^>]*>/i.test(svgText);
    }

    function processCircles(svgText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const groups = doc.querySelectorAll('g');
        let replacedCount = 0;

        groups.forEach((group) => {
            const id = group.getAttribute('id') || '';
            if (!id.includes('Ряд_')) return;

            const shape = group.querySelector('circle') || group.querySelector('ellipse');
            if (!shape) return;

            const newShape = shape.cloneNode(true);
            newShape.setAttribute('id', id);
            group.parentNode.replaceChild(newShape, group);
            replacedCount++;
        });

        const serializer = new XMLSerializer();
        return {
            result: serializer.serializeToString(doc),
            replacedCount: replacedCount
        };
    }

    // ---------- Режим 2: Преобразователь схемы ----------

    const EMPTY_ROW = 'Ряд_::';
    const ROW = 'Ряд_';
    const WRONG_SEAT = '::Место_';
    const PATH_ID = 'Контур_1';

    function hasSchemeMarkers(svgText) {
        return svgText.includes(WRONG_SEAT) || svgText.includes(EMPTY_ROW);
    }

    function processScheme(svgText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');

        // Обработка рядов по id (все элементы с id, начинающимся на "Ряд_")
        const rowElements = doc.querySelectorAll('[id^="Ряд_"]');
        let processedCount = 0;

        rowElements.forEach((el) => {
            let id = el.getAttribute('id');

            // Замена Ряд_:: на Ряд_
            if (id.includes(EMPTY_ROW)) {
                id = id.replace(EMPTY_ROW, ROW);
            }

            // Обработка ::Место_
            if (id.includes(WRONG_SEAT)) {
                const parts = id.split(WRONG_SEAT);
                // Берём часть после ::Место_ и ставим дефис
                if (parts.length >= 2) {
                    id = parts[0] + '-' + parts[1];
                }
            }

            el.setAttribute('id', id);
            processedCount++;
        });

        // Всем path присвоить id = Контур_1
        const paths = doc.querySelectorAll('path');
        paths.forEach((path) => {
            path.setAttribute('id', PATH_ID);
        });

        const serializer = new XMLSerializer();
        return {
            result: serializer.serializeToString(doc),
            replacedCount: processedCount
        };
    }

    // ---------- Запуск обработки ----------

    function processAndShow() {
        let result;

        if (activeMode === 'circles') {
            if (!hasRows(originalSVGText)) {
                showMessage(
                    '⚠️ Ряды не найдены в SVG. Проверьте, что группы имеют id "Ряд_..."',
                    'warning'
                );
                previewSection.classList.remove('visible');
                actions.classList.remove('visible');
                dropZone.classList.remove('file-loaded');
                return;
            }
            const processed = processCircles(originalSVGText);
            processedSVGText = processed.result;
            result = processed;
        } else {
            if (!hasSchemeMarkers(originalSVGText)) {
                showMessage(
                    '⚠️ Маркеры "::Место_" или "Ряд_::" не найдены в SVG.',
                    'warning'
                );
                previewSection.classList.remove('visible');
                actions.classList.remove('visible');
                dropZone.classList.remove('file-loaded');
                return;
            }
            const processed = processScheme(originalSVGText);
            processedSVGText = processed.result;
            result = processed;
        }

        hideMessage();
        showUI();
        renderPreview(processedSVGText);
        dropZone.classList.add('file-loaded');

        const count = result.replacedCount || 0;
        const rowWord = pluralizeRows(count > 0 ? count : 1);

        if (activeMode === 'circles') {
            showMessage(
                `✅ Обработано ${count} ${rowWord}. Файл готов к скачиванию.`,
                'success'
            );
        } else {
            showMessage(
                `✅ Обработано элементов: ${count}. Файл готов к скачиванию.`,
                'success'
            );
        }
    }

    // ---------- Обработка файла ----------

    function handleSVGFile(file) {
        if (!file.name.toLowerCase().endsWith('.svg')) {
            showMessage('Пожалуйста, загрузите файл с расширением .svg', 'warning');
            return;
        }

        currentFileName = file.name.replace(/\.svg$/i, '');

        const reader = new FileReader();

        reader.onload = function(event) {
            originalSVGText = event.target.result;
            processAndShow();
        };

        reader.onerror = function() {
            showMessage('❌ Ошибка чтения файла. Попробуйте другой.', 'warning');
        };

        reader.readAsText(file, 'UTF-8');
    }

    // ---------- Обработчики событий ----------

    // Drag-and-drop
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleSVGFile(files[0]);
        }
    });

    // Клик по зоне — открыть выбор файла
    dropZone.addEventListener('click', function(e) {
        if (e.target === fileInput) return;
        fileInput.click();
    });

    // Выбор файла через input
    fileInput.addEventListener('change', function() {
        if (fileInput.files.length > 0) {
            handleSVGFile(fileInput.files[0]);
            fileInput.value = '';
        }
    });

    // Переключение режимов
    modeCirclesBtn.addEventListener('click', function() {
        setActiveMode('circles');
    });

    modeSchemeBtn.addEventListener('click', function() {
        setActiveMode('scheme');
    });

    // Скачивание
    downloadBtn.addEventListener('click', function() {
        if (processedSVGText) {
            const suffix = activeMode === 'circles' ? '_rounded' : '_fixed';
            downloadSVG(processedSVGText, currentFileName + suffix);
            showMessage('✅ Файл сохранён!', 'success');
        }
    });

    // Очистка
    clearBtn.addEventListener('click', function() {
        originalSVGText = '';
        processedSVGText = '';
        currentFileName = 'scheme';
        hideUI();
        hideMessage();
        dropZone.classList.remove('file-loaded');
        fileInput.value = '';
        activeMode = 'circles';
        setActiveMode('circles');
    });

    // Начальная установка режима
    setActiveMode('circles');

})();