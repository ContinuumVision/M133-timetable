$(function () {
    //api urls
    const jobUrl = 'https://sandbox.gibm.ch/berufe.php';
    const classUrl = 'https://sandbox.gibm.ch/klassen.php';
    const tableUrl = 'https://sandbox.gibm.ch/tafel.php';

    //other const variables
    const lightModeCurrentSubject = "#00cc00";
    const darkModeCurrentSubject = "#0ff";

    const lightParticlesColor = "#000000";
    const darkParticlesColor = "#ffffff";

    //important variables to keep track of some stuff to make internal calculations, not const because they are subject to change
    var startDate;
    var endDate;
    var isMobileFormat;
    var currentDate;
    var isDarkMode = true;
    var particlesEnabled = true;
    var currentLessonEndTime;
    var nextLessonStartTime;
    var currentLessonDate;
    var nextLessonDate;
    var today = moment().format('DD.MM.YYYY');
    var currentHighlight;

    //caching elements for better performance
    const $gibmTable = $('#gibmTable');
    const $tableContainer = $('#tableContainer');
    const $modeSwitch = $('#modeSwitch');
    const $background = $('#background');
    const $moon = $('#moon');
    const $sun = $('#sun');
    const $disableParticles = $('#disableParticles');
    const $jobDrop = $('#jobDrop');
    const $classDrop = $('#classDrop');
    const $pagination = $('.pagination');
    const $paginationA = $('.pagination > li > a');
    const $paginationAFocus = $('.pagination > li > a:focus');
    const $paginationSpanFocus = $('.pagination > li > span:focus');
    const $divider = $('#divider');
    const $info = $('#info');
    const $date = $('#date');
    const $prev = $('#prev');
    const $next = $('#next');
    const $navi = $('#navi');
    const $clock = $('#clock');
    const $hamburger = $('.hamburger');
    const $hamburgerInner = $('.hamburger-inner');
    const $middlePart = $('.middlePart');
    const $container = $('.container');
    const $currentWeek = $('#currentWeek');

    /**
     * populate job dropdown with data received from api
     */
    function populateJobDropdown() {
		//make sure the dropdown is empty before appending new data. this prevents duplicating.
        $jobDrop.empty();
        //set placeholder value as selected so it shows up when no value is selected and the dropdown is closed
        $jobDrop.append('<option selected="true" disabled>Beruf auswählen</option>');
        $jobDrop.prop('selectIndex', 0);
        //jquery ajax request for job data P2.1
        $.getJSON(jobUrl, function () {
           
        }).done(function (data) {
			 $.each(data, function (key, entry) {
                //add every entry to dropdown
                $jobDrop.append($('<option></option>').attr('value', entry.beruf_id).text(entry.beruf_name));
            })
			
            //PB.3, PB.4
            if (localStorage.getItem('job')) {
                var job = localStorage.getItem('job');
                $("#jobDrop option[value=" + job + "]").prop('selected', true);
                populateClassDropdown(job);
            }
            //P2.2
        }).fail(function () {
            alert("Ajax request failed. Please try again.");
        });
    }

    /**
     * 
     * @param {any} jobId the ID of the selected job
     */
    function populateClassDropdown(jobId) {
        //make sure the dropdown is empty before appending new data. this prevents duplicating.
        $classDrop.empty();
        //set placeholder value as selected so it shows up when no value is selected and the dropdown is closed
        $classDrop.append('<option selected="true" disabled>Klasse auswählen</option>');
        $classDrop.prop('selectIndex', 0);
        //jquery ajax request for class data filtered by jobId P2.1
        $.getJSON(classUrl, { beruf_id: jobId }, function () {
            
        }).done(function (data) {
			$.each(data, function (key, entry) {
                //add entry to dropdown
                $classDrop.append($('<option></option>').attr('value', entry.klasse_id).text(entry.klasse_longname));
            })
			
            //PB.3, PB.4
            if (localStorage.getItem('class')) {
                var classID = localStorage.getItem('class');
                $("#classDrop option[value=" + classID + "]").prop('selected', true);
                populateTable(classID, undefined);
            }
            //P5.1
            enableClassDrop(true);
        }).fail(function () {
            //P2.2
            alert("Ajax request failed. Please try again.");
        });
    }

    /**
     * 
     * @param {any} classID the ID of the selected class
     * @param {any} date the desired date
     * @param {any} mobile are we mobile format
     */
    function populateTable(classID, date) {
        //cache table body for better performance
        var table = $('#gibmTable tbody');
        //empty the table before filling it
        table.empty();
        var noData = false;
        //P2.1
        var lastLessonEndTimeLocal;
        var lastLessonStartTimeLocal;
        //jquery ajax request for table data filtered by classID and optionally date P2.1
        $.getJSON(tableUrl, { klasse_id: classID, woche: date }, function () {

        }).done(function (data) {
			            //check if no data has been returned which means no school, PA.5
            if (data.length == 0) {
                //hide overflow if info is displayed to prevent an unnecessary scroll bar
                $tableContainer.css('overflow', 'hidden');
                $info.text('No data found; hopefully holidays (:');
                noData = true;
				//PC.2
				$info.fadeIn(500);
                return;
            } else {
                //enable overflow if ifno is not displayed to show a scroll bar if needed
                $tableContainer.css('overflow', 'visible');
                $info.text("");
            }
            var lastDay = undefined;
            $.each(data, function (key, entry) {
                var t = getCurrentTimeString();
                //format date into a local date string
                var date = moment(entry.tafel_datum).format('DD.MM.YYYY');
                if (date.length == 0) date = '?';
                var currLesson = false;
                var pause = false;
                //check current time against subject time and highlight either the current lesson the break between lessons
                if (t >= entry.tafel_von && t < entry.tafel_bis && date == today) {
                    currLesson = true;
                    lastLessonDate = date;
                    currentHighlight = 'current';
                    lastLessonEndTime = entry.tafel_bis;
                    lastLessonStartTime = entry.tafel_von;
                } else if (t >= lastLessonEndTimeLocal && t < entry.tafel_von && date == today) {
                    pause = true;
                    nextLessonStartTime = entry.tafel_von;
                    nextLessonDate = date;
                    currentHighlight = 'pause';
                }
                lastLessonStartTimeLocal = entry.tafel_von;
                lastLessonEndTimeLocal = entry.tafel_bis;
                //prepare new row, mark it green if it is current lesson and add popover with according room
                var col = isDarkMode ? darkModeCurrentSubject : lightModeCurrentSubject;
                var tr = "<tr ";
                if (isMobileFormat) tr += 'title="Info" ';
                var entryDay = entry.tafel_wochentag;
                var day = getDay(entryDay);
                if (day.length == 0) day = '?';
                tr += 'class="';
                //add classes based on light/dark mode
                if (currLesson) {
                    if (isDarkMode) tr += 'currentLessonDark ';
                    else tr += 'currentLessonLight ';
                } else {
                    if (isDarkMode) tr += 'hoverableDark ';
                    else tr += 'hoverableLight ';
                }
                if (lastDay && (lastDay != day)) {
                    if (isDarkMode) tr += 'dividerDark ';
                    else tr += 'dividerLight ';
                }
                if (pause) {
                    if (isDarkMode) tr += 'pauseDark';
                    else tr += 'pauseLight';
                }
                tr += '" ';
                lastDay = day;
                tr += 'data-html="true" data-toggle="popover" data-trigger="click" data-placement="bottom" data-content="<b>Room:</b> ' + entry.tafel_raum +
                    '<br /><b>Teacher:</b> ' + entry.tafel_lehrer + '" />';
                var tableRow = $(tr);
                //add mouseleave callback to tr to dismiss the popover onmouseleave
                $(tableRow).mouseleave(function () {
                    enablePopover(false, this);
                });
				//check for empty data
                var startTime = entry.tafel_von.slice(0, -3);
                if (startTime.length == 0) startTime = '?';
                var endTime = entry.tafel_bis.slice(0, -3);
                if (endTime.length == 0) endTime = '?';
                var fach = isMobileFormat ? entry.tafel_fach : entry.tafel_longfach;
                if (fach.length == 0) fach = '?';
                var teacher = entry.tafel_lehrer;
                if (teacher.length == 0) teacher = '?';
				//add rows to table
                table.append(tableRow);
                tableRow.append($("<td>" + date + "</td>"));
                if (!isMobileFormat) tableRow.append($("<td>" + day + "</td>"));
                tableRow.append($("<td>" + fach + "</td>"));
                tableRow.append($("<td>" + startTime + "</td>"));
                tableRow.append($("<td>" + endTime + "</td>"));
                if (!isMobileFormat) tableRow.append($("<td>" + teacher + "</td>"));
                if (!isMobileFormat) tableRow.append($("<td>" + entry.tafel_raum + "</td>"));
            })
            if (isMobileFormat) enablePopover(true);
			
            //PC.2, PC.3
			$gibmTable.fadeIn(500);
        }).fail(function () {
            //P2.2
            alert("Ajax request failed. Please try again.");
        });
    }

    /**
     * returns day string from number (0-6)
     * @param {any} entryDay the number for the day received from ajax response
     */
    function getDay(entryDay) {
        var day = parseInt(entryDay);
        switch (day) {
            case 0:
                return "Sonntag";
            case 1:
                return "Montag";
            case 2:
                return "Dienstag";
            case 3:
                return "Mittwoch";
            case 4:
                return "Donnerstag";
            case 5:
                return "Freitag";
            case 6:
                return "Samstag";
            default:
                return null;
        }
    }

    /**
     * sets the currently selected week for the calendar, P6.6
     * @param {any} direction use prev, next, now
     * @param {any} fade decide if table should fade out or not
     * @param {any} init true to initiallize
     */
    function setCurrentWeek(direction, fade, init) {
        var duration = fade ? 300 : 0;
        $info.fadeOut(duration);
        //fade table out, PC.3
        $gibmTable.fadeOut(duration, function () {
            //check if we went back a week or forward and manipulate the date by subtracting or adding 7 days to the currently selected date
            switch (direction) {
                case 'prev':
                    startDate.subtract(7, 'days');
                    endDate.subtract(7, 'days');
                    break;
                case 'next':
                    startDate.add(7, 'days');
                    endDate.add(7, 'days');
                    break;
                case 'now':
                    startDate = moment().startOf('isoweek');
                    endDate = moment().endOf('isoweek');
                    break;
            }
            //format the date to our format
            var formattedStartDate = moment(startDate).format('DD.MM.YYYY');
            var formattedEndDate = moment(endDate).format('DD.MM.YYYY');
            //set the date on the calendar
            $date.text(formattedStartDate + " - " + formattedEndDate);
            //format the date so that we can use it for an ajax request
            var week = startDate.isoWeek();
            var strWeek = week.toString();
            var year = startDate.year();
            var strYear = year.toString();
            if (strWeek.length == 1) strWeek = "0" + strWeek;
            var date = strWeek + "-" + year;
            currentDate = date;
            //P6.6
            $('#navTooltip').attr('data-original-title', date);
            //$('[data-toggle="tooltip"]').tooltip();
            //repopulate table
            if (localStorage.getItem('class') && !init) {
                populateTable(localStorage.getItem('class'), date);
            }
        });
    }

    /**
     * sets the table headings. Responsive to mobile / desktop format, P6.3
     */
    function setHeading() {
        //store reference to table headers in local variable
        var tableHeading = $('#gibmTable thead');
        tableHeading.removeClass('headerDark');
        tableHeading.removeClass('headerLight');
        if (isDarkMode) tableHeading.addClass('headerDark');
        else tableHeading.addClass('headerLight');
        //also empty the heading while we're at it
        tableHeading.empty();
        //prepare heading row
        var heading = $("<tr id='tableHeading' />");
        //append it to table
        tableHeading.append(heading);
        //append headings to row, depends on format
        heading.append($("<th>" + "Date" + "</th>"));
        if (!isMobileFormat) heading.append($("<th>" + "Day" + "</th>"));
        heading.append($("<th>" + "Subject" + "</th>"));
        heading.append($("<th>" + "From" + "</th>"));
        heading.append($("<th>" + "To" + "</th>"));
        if (!isMobileFormat) heading.append($("<th>" + "Teacher" + "</th>"));
        if (!isMobileFormat) heading.append($("<th>" + "Room" + "</th>"));
    }

    /**
     * switches view from mobile to desktop and vice versa. only actually does it if the previous format is different from the current format since the resizing event triggers for every pixel.
     */
    function switchView() {
        if ($(window).width() < 768 && !isMobileFormat) {
            isMobileFormat = true;
            $gibmTable.fadeOut(300, function () {
                populateTable(localStorage.getItem('class'), currentDate);
                setHeading();
            });
        } else if ($(window).width() >= 768 && isMobileFormat) {
            isMobileFormat = false;
            $gibmTable.fadeOut(300, function () {
                populateTable(localStorage.getItem('class'), currentDate);
                setHeading();
            });
        }
    }

    /**
     * initializes the table heading and decides if we're on mobile or desktop
     */
    function initHeading() {
        if ($(window).width() < 768) {
            isMobileFormat = true;
            setHeading();
        } else {
            isMobileFormat = false;
            setHeading();
        }
    }

    /**
     * checks if we have a value named job stored and fades out table if we don't
     */
    function checkLocalStorage() {
        if (!localStorage.getItem('job')) {
            $gibmTable.fadeOut(500);
            //P5.1
            enableClassDrop(false);
        }
    }

    /**
     * enables and fades in or disables and fades out classDrop P5.1, PC.1
     * @param {any} enabled
     */
    function enableClassDrop(enabled) {
        if (enabled) {
            $classDrop.prop('disabled', false);
            $("#classDropContainer").fadeTo('slow', 1);
        } else {
            $classDrop.prop('disabled', true);
            $('#classDropContainer').fadeTo("slow", .33);
            fadeNavi(false);
        }
    }

    /**
     * fades navi in or out
     * @param {any} fadeIn
     */
    function fadeNavi(fadeIn) {
        if (fadeIn) {
            $navi.prop('disabled', false);
            $navi.fadeTo('slow', 1);
        } else {
            $navi.prop('disabled', true);
            $navi.fadeTo('slow', .33);
        }
    }


    /**
     * enables popover functionality
     * @param {any} enable
     * @param {any} popover reference to popover element
     */
    function enablePopover(enable, popover) {
        if (enable) {
            $('[data-toggle="popover"]').popover();
        } else {
            $(popover).popover('hide');
        }
    }

    /**
     * enables and disables glow effect
     * @param {any} dropdown which dropdown to disable glow effect on
     * @param {any} enable
     */
    function handleGlow(dropdown, enable) {
        var drop = dropdown == 'job' ? $jobDrop : $classDrop;
        if (enable) drop.addClass('glow');
        else drop.removeClass('glow');
    }

    /**
     * updats time
     */
    function updateClock() {
        var time = getCurrentTimeString();
        $clock.text(time);

        var s = time.slice(-2);
        if (s == '01') checkCurrentLesson();
    }

    /**
     * checks if we're still in the same lesson
     */
    function checkCurrentLesson() {
        var time = getCurrentTimeString();
        if (currentHighlight == 'current' && time >= currentLessonEndTime && currentLessonDate == today) {
            populateTable(localStorage.getItem('class'), currentDate);
            return;
        }
        if (currentHighlight == 'pause' && time >= nextLessonStartTime && nextLessonDate == today) {
            populateTable(localStorage.getItem('class'), currentDate);
            return;
        }

    }

    /**
     * returns current time as string
     */
    function getCurrentTimeString() {
        var currTime = moment();
        var hour = currTime.hour();
        var minute = currTime.minute();
        var second = currTime.second();

        var h = hour.toString();
        if (h.length == 1) h = "0" + h;
        var m = minute.toString();
        if (m.length == 1) m = "0" + m;
        var s = second.toString();
        if (s.length == 1) s = "0" + s;

        return h + ":" + m + ":" + s;
    }


    //functions that get called once the site is ready //

    //enable tooltip functionality
    $('[data-toggle="tooltip"]').tooltip();
    //populate the job dropdown immediately since no selection is needed for it.
    populateJobDropdown();
    //set the date to the current week
    setCurrentWeek('now', false, true);
    //initialize the heading
    initHeading();
    //check local localStorage
    checkLocalStorage();

    //show glow if no job in localStorage
    if (!localStorage.getItem('job')) {
        handleGlow('job', true);
    }

    //Hide table immediately if no class is selected
    if (!localStorage.getItem('class')) {
        $gibmTable.fadeOut(1);
        fadeNavi(false);
        if (localStorage.getItem('job')) handleGlow('class', true);
    }
    //events //

    //add callback to modeSwitch button
    $sun.on('animationend webkitAnimationEnd oAnimationEnd', function () {
        $modeSwitch.prop('disabled', false);
    });

    //fires everytime the window gets resized; resizing from 1080px width to 1000px width will fire the event 80 times
    $(window).resize(function () {
        switchView();
    });

    //fires when previous button is clicked and goes one week back, PA.3
    $prev.click(function () {
        if (!localStorage.getItem('class')) return;
        setCurrentWeek('prev', true);
    });

    //fires when next button is clicked and goes one week forward, PA.2
    $next.click(function () {
        if (!localStorage.getItem('class')) return;
        setCurrentWeek('next', true);
    });

    //fires when the date itself is clicked which makes it jump back to the current week
    $date.click(function () {
        if (!localStorage.getItem('class')) return;
        setCurrentWeek('now', true);
    });

    //whenever the value in job dropdown gets changed remove the saved class and empty the table, then repopulate the class dropdown
    $jobDrop.change(function () {
        //P4.3
        $gibmTable.fadeOut(500);
        fadeNavi(false);
        handleGlow('job', false);
        handleGlow('class', true);
        localStorage.removeItem('class');
        $('#gibmTable tbody').empty();
        //P4.2
        populateClassDropdown($("#jobDrop option:selected").val());
        //PB.1
        localStorage.setItem('job', $("#jobDrop option:selected").val());
    });

    //whenever the value in class dropdown gets changed store selection and repopulate table
    $classDrop.change(function () {
        //PB.2
        localStorage.setItem('class', $("#classDrop option:selected").val());
        fadeNavi(true);
        handleGlow('class', false);
        //P5.3
        setCurrentWeek('now', true);
    });

    //behaviour for modeSwitch button. Also fuck this function, took way too long.
    $modeSwitch.click(function () {
        //cache those here and not as const because they change when new lesson / break starts
        var $pause = $('.pause');
        var $currentLesson = $('.currentLesson');
        var $option = $(' option');

        $modeSwitch.prop('disabled', true);
        $modeSwitch.blur();
        $modeSwitch.removeClass('focus');

        


        if (isDarkMode) {
            $background.removeClass('animationDark');
            $background.addClass('animationLight');
			
            $moon.removeClass('animationRotateIn');
            $moon.addClass('animationRotateOut');
            $sun.removeClass('animationRotateOut');
            $sun.addClass('animationRotateIn');

            $modeSwitch.removeClass('animationDarkText');
            $modeSwitch.addClass('animationLightText');
            $modeSwitch.text("Dark Mode");
            $modeSwitch.removeClass('darkHover');
            $modeSwitch.addClass('lightHover');

            $disableParticles.removeClass('animationDarkText');
            $disableParticles.addClass('animationLightText');
            $disableParticles.removeClass('darkHover');
            $disableParticles.addClass('lightHover');

            $jobDrop.removeClass('animationDarkText');
            $jobDrop.addClass('animationLightText');
            $jobDrop.removeClass('darkHover');
            $jobDrop.addClass('lightHover');

            $classDrop.removeClass('animationDarkText');
            $classDrop.addClass('animationLightText');
            $classDrop.removeClass('darkHover');
            $classDrop.addClass('lightHover');

            $pagination.addClass('naviLightHover');
            $paginationA.removeClass('animationDarkText');
            $paginationA.addClass('animationLightText');
            $paginationAFocus.removeClass('animationDarkText');
            $paginationAFocus.addClass('animationLightText');
            $paginationSpanFocus.removeClass('animationDarkText');
            $paginationSpanFocus.addClass('animationLightText');

            $divider.removeClass('animationDividerDark');
            $divider.addClass('animationDividerLight');

            $option.removeClass('animationDarkOptions');
            $option.addClass('animationLightOptions');

            $currentLesson.removeClass('animationLessonDark');
            $currentLesson.addClass('animationLessonLight');

            $info.removeClass('animationDarkInfo');
            $info.addClass('animationLightInfo');

            $clock.removeClass('animationDarkText');
            $clock.addClass('animationLightText');

            $container.removeClass('animationContainerDark');
            $container.addClass('animationContainerLight');

            $hamburger.fadeTo(1200, 0.01, function () {
                $hamburgerInner.removeClass('hamburger-dark');
                $hamburgerInner.addClass('hamburger-light');
                $hamburger.fadeTo(1200, 1);
            });

            $middlePart.removeClass('animationDarkText');
            $middlePart.addClass('animationLightText');
            
            $.each(pJSDom[0].pJS.particles.array, function (i, p) {
                pJSDom[0].pJS.particles.array[i].color.value = lightParticlesColor;
                pJSDom[0].pJS.particles.array[i].color.rgb = hexToRgb(lightParticlesColor);
            });

        } else {
            $background.removeClass('animationLight');
            $background.addClass('animationDark');

            $moon.removeClass('animationRotateOut');
            $moon.addClass('animationRotateIn');
            $sun.removeClass('animationRotateIn');
            $sun.addClass('animationRotateOut');

            $modeSwitch.removeClass('animationLightText');
            $modeSwitch.addClass('animationDarkText');
            $modeSwitch.text("Light Mode");
            $modeSwitch.removeClass('lightHover');
            $modeSwitch.addClass('darkHover');

            $disableParticles.removeClass('animationLightText');
            $disableParticles.addClass('animationDarkText');
            $disableParticles.removeClass('lightHover');
            $disableParticles.addClass('darkHover');

            $jobDrop.removeClass('animationLightText');
            $jobDrop.addClass('animationDarkText');
            $jobDrop.removeClass('lightHover');
            $jobDrop.addClass('darkHover');

            $classDrop.removeClass('animationLightText')
            $classDrop.addClass('animationDarkText');
            $classDrop.removeClass('lightHover');
            $classDrop.addClass('darkHover');

            $pagination.removeClass('naviLightHover');
            $paginationA.removeClass('animationLightText');
            $paginationA.addClass('animationDarkText');
            $paginationAFocus.removeClass('animationLightText');
            $paginationAFocus.addClass('animationDarkText');
            $paginationSpanFocus.removeClass('animationLightText');
            $paginationSpanFocus.addClass('animationDarkText');

            $divider.removeClass('animationDividerLight');
            $divider.addClass('animationDividerDark');

            $option.removeClass('animationLightOptions');
            $option.addClass('animationDarkOptions');

            $currentLesson.removeClass('animationLessonLight');
            $currentLesson.addClass('animationLessonDark');

            $info.removeClass('animationLightInfo');
            $info.addClass('animationDarkInfo');

            $clock.removeClass('animationLightText');
            $clock.addClass('animationDarkText');

            $container.removeClass('animationContainerLight');
            $container.addClass('animationContainerDark');

            $hamburger.fadeTo(1200, 0.01, function () {
                $hamburgerInner.removeClass('hamburger-light');
                $hamburgerInner.addClass('hamburger-dark');
                $hamburger.fadeTo(1200, 1);
            });

            $middlePart.removeClass('animationLightText');
            $middlePart.addClass('animationDarkText');

            $.each(pJSDom[0].pJS.particles.array, function (i, p) {
                pJSDom[0].pJS.particles.array[i].color.value = darkParticlesColor;
                pJSDom[0].pJS.particles.array[i].color.rgb = hexToRgb(darkParticlesColor);
            });
        }
        isDarkMode = !isDarkMode;
        $gibmTable.fadeOut(2000, function () {
            populateTable(localStorage.getItem('class'), currentDate);
            setHeading();
			if(!isDarkMode){
				$gibmTable.removeClass('tableDark');
				$gibmTable.addClass('tableLight');
			}
			else{
				$gibmTable.removeClass('tableLight');
				$gibmTable.addClass('tableDark');		
			}
        });
    });

    $disableParticles.click(function () {
        if (particlesEnabled) {
            $('#particles-js').remove();
            $disableParticles.text("Enable Particles");
        } else {
            if (confirm('This requires a refresh of the page. Continue?')) {
                location.reload();
            }
        }
        particlesEnabled = !particlesEnabled;
    });

    $hamburger.click(function () {
        $hamburger.toggleClass('is-active');
        $middlePart.slideToggle();
    });

    //set up functions that run periodically
    updateClock();
    setInterval(updateClock, 1000);
});
