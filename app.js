(function() {
    'use strict';

    // DOM-элементы
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const messageEl = document.getElementById('message');
    const previewSection = document.getElementById('previewSection');
    const previewContainer = document.getElementById('previewContainer');
    const actions = document.getElementById('actions');
    const downloadBtn = document.getElementById('downloadBtn');
    const clearBtn = document.getElementById('clearBtn');

    let originalSVGText = '';
    let processedSVGText = '';
    let currentFileName = 'scheme';

    // --- Вспомогательные функции ---

    function showMessage(text, type = 'warning') {
        messageEl.textContent = text;
        messageEl.className = `message message--${type} visible`;
    }

    function hideMessage() {
        messageEl.className = 'message';
    }

    function showUI() {
        previewSection.classList.add('visible');
        actions.classList.add('visible');
    }

    function hideUI() {
        previewSection.classList.remove('visible');
        actions.classList.remove('visible');
        previewContainer.innerHTML = '';
        dropZone.classList.remove('file-loaded');
    }

    /**
     * Проверяет, есть ли в SVG-разметке группы с id, содержащим "Ряд_"
     * @param {string} svgText - SVG-разметка
     * @returns {boolean}
     */
    function hasRows(svgText) {
        const pattern = /<g[^>]*\bid\s*=\s*["']([^"']*Ряд_[^"']*)["'][^>]*>/i;
        return pattern.test(svgText);
    }

    /**
     * Заменяет группы <g> с id "Ряд_..." на содержащиеся в них <circle> или <ellipse>
     * @param {string} svgText - исходная SVG-разметка
     * @returns {{ result: string, replacedCount: number }}
     */
    function processSVG(svgText) {
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
        const result = serializer.serializeToString(doc);
        return { result, replacedCount };
    }

    /**
     * Отображает SVG в контейнере предпросмотра
     * @param {string} svgText
     */
    function renderPreview(svgText) {
        previewContainer.innerHTML = svgText;
    }

    /**
     * Скачивает SVG-файл
     * @param {string} svgText
     * @param {string} filename
     */
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

    /**
     * Склоняет слово "ряд" в зависимости от числа
     * @param {number} count
     * @returns {string}
     */
    function pluralizeRows(count) {
        const mod10 = count % 10;
        const mod100 = count % 100;
        if (mod10 === 1 && mod100 !== 11) return 'ряд';
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'ряда';
        return 'рядов';
    }

    /**
     * Обрабатывает загруженный файл
     * @param {File} file
     */
    function handleSVGFile(file) {
        // Проверка расширения
        if (!file.name.toLowerCase().endsWith('.svg')) {
            showMessage('Пожалуйста, загрузите файл с расширением .svg', 'warning');
            return;
        }

        currentFileName = file.name.replace(/\.svg$/i, '');

        const reader = new FileReader();

        reader.onload = function(event) {
            originalSVGText = event.target.result;

            if (!hasRows(originalSVGText)) {
                showMessage(
                    '⚠️ Ряды не найдены в SVG. Проверьте, что группы имеют id "Ряд_..."',
                    'warning'
                );
                hideUI();
                dropZone.classList.remove('file-loaded');
                return;
            }

            const { result, replacedCount } = processSVG(originalSVGText);
            processedSVGText = result;

            hideMessage();
            showUI();
            renderPreview(processedSVGText);
            dropZone.classList.add('file-loaded');

            const rowWord = pluralizeRows(replacedCount);
            showMessage(
                `✅ Обработано ${replacedCount} ${rowWord}. Файл готов к скачиванию.`,
                'success'
            );
        };

        reader.onerror = function() {
            showMessage('❌ Ошибка чтения файла. Попробуйте другой.', 'warning');
        };

        reader.readAsText(file, 'UTF-8');
    }

    // --- Обработчики событий ---

    // Drag-and-drop: drag over
    dropZone.addEventListener('dragover', function(event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    // Drag-and-drop: drag leave
    dropZone.addEventListener('dragleave', function(event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove('drag-over');
    });

    // Drag-and-drop: drop
    dropZone.addEventListener('drop', function(event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove('drag-over');

        const files = event.dataTransfer.files;
        if (files.length > 0) {
            handleSVGFile(files[0]);
        }
    });

    // Клик по зоне загрузки — открывает диалог выбора файла
    dropZone.addEventListener('click', function(event) {
        if (event.target === fileInput) return;
        fileInput.click();
    });

    // Выбор файла через input
    fileInput.addEventListener('change', function() {
        if (fileInput.files.length > 0) {
            handleSVGFile(fileInput.files[0]);
            fileInput.value = ''; // позволяет выбрать тот же файл повторно
        }
    });

    // Кнопка скачивания
    downloadBtn.addEventListener('click', function() {
        if (processedSVGText) {
            downloadSVG(processedSVGText, currentFileName + '_rounded');
            showMessage('✅ Файл сохранён!', 'success');
        }
    });

    // Кнопка очистки
    clearBtn.addEventListener('click', function() {
        originalSVGText = '';
        processedSVGText = '';
        currentFileName = 'scheme';
        hideUI();
        hideMessage();
        dropZone.classList.remove('file-loaded');
        fileInput.value = '';
    });

})();