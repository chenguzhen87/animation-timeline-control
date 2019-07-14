var animationTimeline = function (window, document) {

	let width = 0;
	if (!Math.sign) {
		Math.sign = function (p) {
			return p >= 0 ? 1 : -1;
		}
	}

	let defaultOptions = {
		keysPerSecond: 60,
		snapPointsPerPixel: 5, // from 1 to 60
		snapEnabled: true,
		extraRightMargin: 50,
		timelineThicknessPx: 2,
		timelineMarginTopPx: 15,
		timelineCapWidthPx: 4,
		timelineCapHeightPx: 10,
		timelineTriangleCap: false,
		timelineRectCap: true,
		// approximate step in px for 1 second 
		stepPx: 100,
		stepSmallPx: 30,
		smallSteps: 50,
		// additional left margin to start the gauge from
		leftMarginPx: 25,
		minTimelineToDispayMs: 5000,
		headerBackground: 'black',
		selectedLaneColor: '#333333',
		// lanes colors
		laneColor: 'white',
		alternateLaneColor: 'black',//333333
		useAlternateLaneColor: false,
		keyframesLaneColor: 'red',
		// keyframe color. can be overrided by a keyframe 'color' property.
		keyframeColor: 'Yellow',
		// selected keyframe color. can be overrider by a keyframe 'selectedColor' property.
		selectedKeyframeColor: 'DarkOrange',
		keyframeBorderColor: 'Black',
		keyframeBorderThicknessPx: 0.2,
		// can be a number or 'auto'. can be overriden by 'keyframe.size'. Auto is calculated based on the laneHeightPx.
		keyframeSizePx: 'auto',
		backgroundColor: 'black',//1E1E1E
		timeIndicatorColor: 'DarkOrange',
		labelsColor: '#D5D5D5',
		tickColor: '#D5D5D5',
		selectionColor: 'White',
		laneHeightPx: 24,
		laneMarginPX: 1,
		keyframeLaneMargin: 2,
		headerHeight: 30,
		lineHeight: 1,
		autoWidth: true,
		ticksFont: "11px sans-serif",
		zoom: 1000,
		id: '',
		scrollId: ''
	}
	var denominators = [1, 2, 5, 10];
	var clickDetectionMs = 120;

	function getPixelRatio(ctx) {
		dpr = window.devicePixelRatio || 1,
			bsr = ctx.webkitBackingStorePixelRatio ||
			ctx.mozBackingStorePixelRatio ||
			ctx.msBackingStorePixelRatio ||
			ctx.oBackingStorePixelRatio ||
			ctx.backingStorePixelRatio || 1;

		return dpr / bsr;
	}

	function msToHMS(ms, isSeconds) {
		// 1- Convert to seconds:
		var seconds = ms / 1000;
		if (isSeconds) {
			seconds = ms;
		}
		// 2- Extract hours:
		var hours = parseInt(seconds / 3600); // 3,600 seconds in 1 hour
		seconds = seconds % 3600; // seconds remaining after extracting hours
		// 3- Extract minutes:
		var minutes = parseInt(seconds / 60); // 60 seconds in 1 minute
		// 4- Keep only seconds not extracted to minutes:
		seconds = (seconds % 60);
		let str = '';
		if (hours) {
			str += hours + ":";
		}

		if (minutes) {
			str += minutes + ":";
		}

		if (!isNaN(seconds)) {
			str += seconds;
		}

		return str;
	}


	/**
	 * Check rectangle overlap.
	 * @param {number} x1 
	 * @param {number} y1 
	 * @param {object} rectangle 
	 */
	function isOverlap(x, y, rectangle) {
		if (!rectangle) {
			console.log('Rectange cannot be empty');
			return false;
		}

		if (rectangle.x <= x && (rectangle.x + rectangle.w) >= x &&
			rectangle.y <= y && (rectangle.y + rectangle.h) >= y) {
			return true;
		}

		return false;
	}

	function isRectOverlap(rect, rect2) {
		if (!rect || rect2) {
			console.log('Rectanges cannot be empty');
			return false;
		}

		if (isOverlap(rect.x, rect.y, rect2) ||
			isOverlap(rect.x + rect.w, rect.y, rect2) ||
			isOverlap(rect.x + rect.w, rect.y + rect.h, rect2) ||
			isOverlap(rect.x, rect.y + rect.h, rect2)) {
			return true;
		}

		return false;
	}

	function getDistance(x1, y1, x2, y2) {
		if (x2 != undefined && y2 != undefined) {
			return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
		}
		else {
			return Math.abs(x1 - y1);
		}
	}

	function getPowArgument(toCheck) {
		if (!toCheck || toCheck === 0) {
			return 1;
		}
		// some optimiazation for numbers:
		if (toCheck >= 10 && toCheck < 100) {
			return 1;
		} else if (toCheck >= 100 && toCheck < 1000) {
			return 2;
		} else if (toCheck >= 1000 && toCheck < 10000) {
			return 3;
		}

		toCheck = Math.abs(toCheck);
		var category = 0;
		var sign = Math.sign(toCheck);
		if (toCheck > 1) {
			while (toCheck >= 1) {
				toCheck = Math.floor(toCheck / 10.0);
				category++;
			}

			return sign * category - 1;
		}
		else if (toCheck > 0.0) {
			// Get number of zeros before the number.
			var zerosCount = -Math.floor(Math.log(toCheck) / Math.log(10) + 1);
			return sign * (zerosCount - 1);
		}
		else {
			return 1;
		}
	}


	this.initialize = function (options, lanes) {
		var timeLine = {
			ms: 3503,
			width: 5,
			isDrag: false,
		}

		// Merge options with the default:
		for (var key in defaultOptions) {
			if (defaultOptions.hasOwnProperty(key) && options[key] == undefined) {
				options[key] = defaultOptions[key];
			}
		}

		if (!options.stepPx) {
			options.stepPx = defaultOptions.stepPx;
		}
		if (!options.snapPointsPerPixel) {
			if (options.snapPointsPerPixel < 0) {
				options.snapPointsPerPixel = 0;
			} else if (options.snapPointsPerPixel > 60) {
				options.snapPointsPerPixel = 60;
			}
		}

		var startPos = null;
		var currentPos = null;
		var selectionRect = null;
		var drag = null;
		var clickDurarion = null;
		var scrollContainer = document.getElementById(options.scrollId);
		var canvas = document.getElementById(options.id);
		var size = document.getElementById(options.sizeId);

		if (!canvas || !canvas.getContext) {
			console.log('Cannot find canvas by id:' + options.id);
			return null;
		}

		var ctx = canvas.getContext("2d");
		ctx.drawLine = function (x1, y1, x2, y2) {
			this.moveTo(x1, y1);
			this.lineTo(x2, y2);
		}

		var pixelRatio = getPixelRatio(ctx);
		function getMousePos(canvas, evt) {
			var rect = canvas.getBoundingClientRect(), // abs. size of element
				scaleX = canvas.width / pixelRatio / rect.width, // relationship bitmap vs. element for X
				scaleY = canvas.height / pixelRatio / rect.height; // relationship bitmap vs. element for Y

			// scale mouse coordinates after they have been adjusted to be relative to element
			return {
				x: (evt.clientX - rect.left) * scaleX,
				y: (evt.clientY - rect.top) * scaleY
			}
		}

		function rescale() {
			var width = scrollContainer.clientWidth * pixelRatio;
			var height = scrollContainer.clientHeight * pixelRatio;
			if (width != ctx.canvas.width)
				ctx.canvas.width = width;
			if (height != ctx.canvas.height)
				ctx.canvas.height = height;

			ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
		}
		// Check whether we can drag something here.
		function getDragableObject(pos) {
			var objPos = msToPx(timeLine.ms);
			var fromX = objPos - timeLine.width / 2;
			var toX = objPos + timeLine.width / 2;
			if (pos.x >= fromX && pos.x <= toX) {
				canvas.style.cursor = "move";
				timeLine.selected = true;
				return { obj: timeLine, type: "timeline" };

			}

			// Find suitable keyframe to drag:
			for (var i = 0; i < lanes.length; i++) {
				var lane = lanes[i];

				obj = null;
				if (lane.keyframes) {
					let laneY = getLanePosition(i);
					var obj = null;
					let laneYCenter = laneY + options.laneHeightPx / 2;
					for (var x = 0; x < lane.keyframes.length; x++) {
						keyframe = lane.keyframes[x];
						if (keyframe && !isNaN(keyframe.ms)) {
							objPos = msToPx(keyframe.ms);
							var dist = getDistance(objPos, laneYCenter, pos.x, pos.y);
							if (dist <= options.laneHeightPx / 4) {
								canvas.style.cursor = "move";
								if (!obj) {
									obj = {
										obj: keyframe,
										type: 'keyframe',
										distance: dist
									}
								} else if (dist <= obj.distance) {
									obj.obj = keyframe;
								}
							}
						}
					}

					if (obj) {
						return obj;
					}
				}

			}

			canvas.style.cursor = null;
		}

		canvas.addEventListener("wheel", function (event) {
			if (event.ctrlKey) {
				const delta = Math.sign(event.deltaY) * 10;
				options.zoom += delta;
				if (options.zoom <= 0) {
					options.zoom = 0;
				}
				event.preventDefault();
				redraw();
			}
		});

		scrollContainer.addEventListener('scroll', function (args) {
			var left = scrollContainer.scrollLeft + 'px';
			if (canvas.style.left != left) {
				canvas.style.left = left;
			}
			var top = scrollContainer.scrollTop + 'px';
			if (top !== canvas.style.top) {
				canvas.style.top = top;
			}

			redraw();
		});

		window.addEventListener('blur', function (args) {
			cleanUpSelection();
		}, false);

		window.addEventListener('resize', function (args) {
			// Rescale and redraw
			rescale();
			redraw();
		}, false);


		canvas.addEventListener('mousedown', function (args) {
			startPos = trackMousePos(canvas, args);
			clickDurarion = new Date();
			currentPos = startPos;
			startPos.scrollLeft = scrollContainer.scrollLeft;
			startPos.scrollTop = scrollContainer.scrollTo;
			drag = getDragableObject(currentPos);
			// Select keyframes on mouse down
			if (drag && drag.type == 'keyframe') {
				performSelection(drag.obj, null, true);
			}

			redraw();
		}, false);


		window.addEventListener('mousemove', function (args) {
			trackMousePos(canvas, args);
			let ms = pxToMS(currentPos.x);
			if (selectionRect && checkClickDurationOver()) {
				selectionRect.draw = true;
			}

			//console.log('x: ' + currentPos.x + '. ms:' + pxToMS(currentPos.x) + '. px:' + msToPx(ms));
			if (startPos) {
				if (args.buttons == 1) {
					scrollByMouse(currentPos.x);
					if (drag && drag.obj) {
						let convertedMs = pxToMS(scrollContainer.scrollLeft + Math.min(currentPos.x, canvas.clientWidth));
						convertedMs = Math.round(convertedMs);

						// Apply snap to steps if enabled.
						if (options.snapPointsPerPixel && options.snapEnabled) {
							var stopsPerPixel = (1000 / options.snapPointsPerPixel);
							let step = convertedMs / stopsPerPixel;
							stepsFit = Math.round(step);
							convertedMs = Math.round(stepsFit * stopsPerPixel);
						}

						if (convertedMs < 0) {
							convertedMs = 0;
						}


						//redraw();
						if (drag.type == 'timeline') {
							setTime(convertedMs);
							redraw();
						} else if (drag.type == 'keyframe') {
							drag.obj.ms = convertedMs;
							redraw();
						}

						return;
					}
				}
				else {
					// Cancel mouse move when focus was lost.
					cleanUpSelection();
				}
				redraw();
			} else {
				// TODO: used to change mouse cursor. 
				// Should be changed.
				getDragableObject(currentPos);
			}
		}, false);

		window.addEventListener('mouseup', function (args) {
			//window.releaseCapture();
			let pos = trackMousePos(canvas, args);

			if (!drag) {
				// Click detection.
				if (selectionRect && selectionRect.h <= 2 && selectionRect.w <= 2 ||
					!checkClickDurationOver()) {
					// Set current timeline position if it's not a drag or selection rect small or fast click.
					setTime(pxToMS(pos.x));
				} else if (selectionRect) {
					performSelection(null, selectionRect, true);
				}
			}

			cleanUpSelection();
			redraw();
		}, false);

		selectedKeyframes = [];
		function performSelection(keyframeToSet, rectangle, value) {
			if (value === undefined) {
				value = true;
			}

			selectedKeyframes.length = 0;
			let isChanged = true;
			iterateKeyframes(function seletionIterator(keyframe, keyframeIndex, lane, laneIndex) {
				let keyframePos = getKeyframePosition(keyframe, laneIndex);
				if (keyframePos) {
					if (keyframeToSet == keyframe || (rectangle && isOverlap(keyframePos.x, keyframePos.y, rectangle))) {
						if (keyframe.selected != value) {
							keyframe.selected = value;
							isChanged = true;
						}

						if (keyframe.selected) {
							selectedKeyframes.push(keyframe);
						}
					} else {
						// Deselect all other keyframes.
						if (keyframe.selected != false) {
							keyframe.selected = false;
							isChanged = true;
						}
					}
				}
			});

			if (isChanged) {
				onKeyframesSelected(selectedKeyframes);
				redraw();
			}
		}

		function iterateKeyframes(callback) {
			if (!lanes || !lanes.forEach || lanes.length <= 0) {
				return false;
			}

			lanes.forEach(function lanesIterator(lane, index) {
				if (!lane || !lane.keyframes || !lane.keyframes.forEach || lane.keyframes.length <= 0) {
					return;
				}

				lane.keyframes.forEach(function keyframesIterator(keyframe, keyframeIndex) {
					if (callback && keyframe) {
						callback(keyframe, keyframeIndex, lane, index);
					}
				});
			});
		}

		function trackMousePos(canvas, mouseArgs) {
			currentPos = getMousePos(canvas, mouseArgs);
			if (startPos) {
				if (!selectionRect) {
					selectionRect = {};
				}

				selectionRect.x = Math.min(startPos.x, currentPos.x);
				selectionRect.y = Math.min(startPos.y, currentPos.y);
				selectionRect.w = Math.max(startPos.x, currentPos.x) - selectionRect.x;
				selectionRect.h = Math.max(startPos.y, currentPos.y) - selectionRect.y;
			}
			return currentPos;
		}

		function cleanUpSelection() {
			startPos = null;
			drag = null;
			selectionRect = null;
			clickDurarion = null;
			clearMoveInterval();
		}

		function checkClickDurationOver() {
			// Duration before the selection can be tracked.
			if ((clickDurarion && new Date() - clickDurarion > clickDetectionMs)) {
				return true;
			}

			return false;
		}

		width = canvas.clientWidth;
		//stepsCanFit

		rescale();

		let lastX = null;
		let intervalReference = null;
		let lastCallDate = null;
		function startMoveInterval(x) {
			if (!intervalReference) {
				// Repeat move calls to
				intervalReference = setInterval(function () {
					if (lastX !== null) {
						scrollByMouse(lastX);
					}
				}, 300);
			}
		}
		function clearMoveInterval() {
			if (intervalReference) {
				clearInterval(intervalReference);
				intervalReference = null;
			}

			lastCallDate = null;
		}

		function checkUpdateSpeedIsFast() {
			// Dont update too often.
			if (lastCallDate && new Date() - lastCallDate <= 500) {
				return true;
			}

			lastCallDate = new Date();
			return false;
		}

		function scrollByMouse(x) {
			lastX = x;
			if (x <= 0) {
				// Auto move init
				startMoveInterval(x);

				if (checkUpdateSpeedIsFast()) {
					return;
				}

				let speed = Math.floor(Math.max(options.stepPx, getDistance(x, 0)));
				scrollContainer.scrollLeft -= speed;
			} else if (x >= canvas.clientWidth) {

				// Auto move init
				startMoveInterval(x);

				if (checkUpdateSpeedIsFast()) {
					return;
				}


				// One second distance: 
				let speed = Math.floor(Math.max(options.stepPx, getDistance(x, canvas.clientWidth)));
				let step = canvas.clientWidth / scrollContainer.scrollWidth;

				speed = 10;//options.stepPx * step;
				if (x) {
					width = width + speed;
				}
				size.style.minWidth = width + "px";
				// Scroll left
				scrollContainer.scrollLeft += speed;
			}
			else {
				clearMoveInterval();
			}
			rescale();
			redraw();
		}

		scrollByMouse();

		// Find ms from the the px coordinates
		function pxToMS(coords) {
			coords -= options.leftMarginPx;
			var ms = coords / options.stepPx * options.zoom;
			return ms;
		}

		// convert 
		function msToPx(ms) {
			// Respect current scroll container offset. (virtualization)
			var x = scrollContainer.scrollLeft;//- options.leftMarginPx;
			ms -= pxToMS(x);
			return (ms * options.stepPx / options.zoom);
		}

		function findGoodStep(originaStep, divisionCheck) {
			originaStep = Math.round(originaStep);
			var step = originaStep;
			var lastDistance = null;
			var pow = getPowArgument(originaStep);
			for (var i = 0; i < denominators.length; i++) {
				denominator = denominators[i];
				var calculatedStep = denominator * Math.pow(10, pow);
				if (divisionCheck && (divisionCheck % calculatedStep) != 0) {
					continue;
				}
				var distance = getDistance(originaStep, calculatedStep);

				if (distance <= 0.1) {
					lastDistance = distance;
					step = calculatedStep;
					break;
				} else if (!lastDistance || lastDistance > distance) {
					lastDistance = distance;
					step = calculatedStep;
				}
			}

			return step;
		}

		function drawTicks() {
			ctx.save();

			var areaWidth = scrollContainer.scrollWidth - options.leftMarginPx;
			var from = pxToMS(0);
			var to = pxToMS(areaWidth);
			var dist = getDistance(from, to);
			// normalize step.			
			var stepsCanFit = areaWidth / options.stepPx;

			// Find the nearest 'beautiful' step for a gauge. This step should be devided by 1/2/5!
			var step = findGoodStep(Math.round(dist / stepsCanFit));
			var goodStepDistancePx = areaWidth / (dist / step);
			var smallStepsCanFit = goodStepDistancePx / options.stepSmallPx;
			var realSmallStep = step / smallStepsCanFit;
			var smallStep = findGoodStep(realSmallStep, step);
			if (step % smallStep != 0) {
				smallStep = realSmallStep;
			}
			// filter to draw only visible
			var visibleFrom = pxToMS(scrollContainer.scrollLeft + options.leftMarginPx);
			var visibleTo = pxToMS(scrollContainer.scrollLeft + scrollContainer.clientWidth);
			// Find beautiful start point:
			from = Math.floor(visibleFrom / step) * step;

			// Find a beautiful end point:
			to = Math.ceil(visibleTo / step) * step + step;

			for (var i = from; i <= to; i += step) {
				var pos = msToPx(i);
				var sharpPos = getSharp(Math.round(pos));
				ctx.save();
				ctx.beginPath();
				ctx.setLineDash([4]);
				ctx.lineWidth = pixelRatio;
				ctx.strokeStyle = options.tickColor;
				ctx.drawLine(sharpPos, (options.headerHeight || 0) / 2, sharpPos, canvas.clientHeight);
				ctx.stroke();

				ctx.fillStyle = options.labelsColor;
				if (options.ticksFont) {
					ctx.font = options.ticksFont;
				}

				var text = msToHMS(i)
				var textSize = ctx.measureText(text);

				sharpPos -= textSize.width / 2;
				ctx.fillText(text, sharpPos, 10);
				ctx.restore();
				// Draw small steps
				for (let x = i + smallStep; x < i + step; x += smallStep) {
					var nextPos = msToPx(x);
					var nextSharpPos = getSharp(Math.floor(nextPos));
					ctx.beginPath();
					ctx.lineWidth = pixelRatio;
					ctx.strokeStyle = options.tickColor;
					ctx.drawLine(nextSharpPos, (options.headerHeight || 0) / 1.3, nextSharpPos, options.headerHeight);
					ctx.stroke();
				}
			}

			ctx.restore();
		}

		function drawLanes() {
			if (!lanes || !lanes.forEach || lanes.length <= 0) {
				return false;
			}

			ctx.save();
			// Draw lane for each control
			lanes.forEach(function (lane, index) {
				if (lane.selected && options.selectedLaneColor) {
					ctx.fillStyle = options.selectedLaneColor;
				} else if (index % 2 != 0 && options.useAlternateLaneColor) {
					ctx.fillStyle = options.alternateLaneColor || options.laneColor;
				} else {
					ctx.fillStyle = options.laneColor;
				}


				let laneY = getLanePosition(index);
				if (ctx.fillStyle) {
					ctx.fillRect(0, laneY, canvas.clientWidth, options.laneHeightPx);
				}

				if (!lane || !lane.keyframes || !lane.keyframes.forEach || lane.keyframes.length <= 0) {
					return;
				}

				// Draw keyframes lanes
				if (options.keyframesLaneColor) {
					var from = null;
					var to = null;
					lane.keyframes.forEach(function (keyframe) {
						if (keyframe && !isNaN(keyframe.ms)) {
							if (from == null) {
								from = keyframe.ms;
							} else {
								from = Math.min(keyframe.ms, from);
							}

							if (to == null) {
								to = keyframe.ms
							} else {
								to = Math.max(keyframe.ms, to);
							}
						}
					});

					// draw keyframes lane.
					var fromPos = getSharp(msToPx(from))
					var toPos = getSharp(msToPx(to));
					ctx.fillStyle = options.keyframesLaneColor;
					ctx.fillRect(fromPos, laneY + 1, getDistance(fromPos, toPos), options.laneHeightPx - 2);
				}

			});
			ctx.restore();

			return true;
		}

		function getLanePosition(laneIndex) {
			let laneY = options.headerHeight +
				laneIndex * options.laneHeightPx * pixelRatio +
				laneIndex * options.laneMarginPX;
			return laneY;
		}

		function getKeyframePosition(keyframe, laneIndex) {
			if (!keyframe) {
				console.log('keyframe should be defined.');
				return null;
			}

			let ms = keyframe.ms;
			if (isNaN(ms)) {
				console.log('Cannot find x of the keyframe. ms is not a number!');
				return null;
			}

			// get center of the lane:
			var y = getLanePosition(laneIndex) + options.laneHeightPx / 2;

			// keyframe size:
			var size = options.keyframeSizePx || keyframe.size;
			if (size == 'auto') {
				size = options.laneHeightPx / 3;
			}

			if (size > 0) {
				if (!isNaN(ms)) {
					return { x: Math.floor(msToPx(ms)), y: Math.floor(y), size: size };
				}
			}

			return null;
		}


		function drawKeyframes() {
			if (!lanes || !lanes.forEach || lanes.length <= 0) {
				return false;
			}

			iterateKeyframes(function seletionIterator(keyframe, keyframeIndex, lane, laneIndex) {
				var pos = getKeyframePosition(keyframe, laneIndex);
				if (pos) {
					let x = getSharp(pos.x);
					let y = getSharp(pos.y);
					let size = pos.size;
					ctx.save();
					ctx.beginPath();
					ctx.translate(x, y);
					ctx.rotate(45 * Math.PI / 180);
					let border = options.keyframeBorderThicknessPx;
					if (border > 0 && options.keyframeBorderColor) {
						ctx.fillStyle = options.keyframeBorderColor;
						ctx.rect(-size / 2, -size / 2, size, size);
						ctx.fill();
						ctx.beginPath();
					}

					ctx.fillStyle = keyframe.color || options.keyframeColor;
					if (keyframe.selected) {
						ctx.fillStyle = keyframe.selectedColor || options.selectedKeyframeColor;
					}
					// draw main keyframe data with offset.
					ctx.translate(border, border);
					ctx.rect(-size / 2, -size / 2, size - border * 2, size - border * 2);
					ctx.fill();
					ctx.restore();
				}
			});
		}

		function drawSelection() {
			if (drag) {
				return;
			}

			ctx.save();
			var thickness = 1;
			if (selectionRect && selectionRect.draw) {
				ctx.setLineDash([4]);
				ctx.lineWidth = pixelRatio;
				ctx.strokeStyle = options.selectionColor;
				ctx.strokeRect(
					getSharp(selectionRect.x, thickness),
					getSharp(selectionRect.y, thickness),
					Math.floor(selectionRect.w),
					Math.floor(selectionRect.h));
			}
			ctx.restore();
		}

		function drawBackground() {
			if (options.backgroundColor) {
				ctx.save();
				ctx.beginPath();
				ctx.rect(0, 0, canvas.clientWidth, canvas.clientHeight);
				ctx.fillStyle = options.backgroundColor;
				ctx.fill();
				ctx.restore();
				return true;
			}
			return false;
		}

		function drawTimeLine() {
			ctx.save();

			var thickness = options.timelineThicknessPx;
			ctx.lineWidth = thickness * pixelRatio;
			var timeLinePos = getSharp(Math.round(msToPx(timeLine.ms)), thickness);
			ctx.strokeStyle = options.timeIndicatorColor;
			ctx.fillStyle = ctx.strokeStyle;
			var y = options.timelineMarginTopPx;
			ctx.beginPath();
			ctx.drawLine(timeLinePos, y, timeLinePos, canvas.clientHeight);
			ctx.stroke();

			if (options.timelineCapWidthPx && options.timelineCapHeightPx) {
				var rectSize = options.timelineCapWidthPx;
				var capHeight = options.timelineCapHeightPx;
				if (options.timelineTriangleCap) {
					ctx.beginPath();
					ctx.moveTo(timeLinePos - rectSize / 2, y);
					ctx.lineTo(timeLinePos + rectSize / 2, y);
					ctx.lineTo(timeLinePos, capHeight);
					ctx.closePath();
					ctx.stroke();
				}
				else if (options.timelineRectCap) {
					ctx.fillRect(timeLinePos - rectSize / 2, y, rectSize, capHeight);
					ctx.fill();
				}
			}

			ctx.restore();
		}

		function drawHeaderBackground() {
			if (options.headerBackground) {
				ctx.save();
				// draw ticks background
				ctx.lineWidth = pixelRatio;

				// draw header background
				ctx.fillStyle = options.headerBackground;
				ctx.fillRect(0, 0, canvas.clientWidth, options.headerHeight);
				ctx.restore();
				return true;
			}

			return false;
		}

		function redraw() {

			var isOk = drawBackground();
			if (!isOk) {
				// Clear if bg not set.
				ctx.clearRect(0, 0, canvas.width, canvas.height);
			}

			drawHeaderBackground();
			drawLanes();
			drawTicks();
			drawKeyframes();
			drawSelection();
			drawTimeLine();
		}

		function getSharp(pos, thinkess) {
			if (!thinkess) {
				thinkess = 1;
			}

			if (thinkess % 2 == 0) {
				return pos;
			}

			return pos + pixelRatio / 2;
		}

		rescale();
		redraw();

		/**
		 * Get current time in ms.
		 * @public
		 */
		this.getTime = function () {
			return timeLine.ms;
		}

		this.setTime = function (ms) {
			ms = Math.round(ms);
			if (ms < 0) {
				ms = 0;
			}

			if (timeLine.ms != ms) {
				timeLine.ms = ms;
				this.emit('timeChanged', ms);
			}
		}

		function onKeyframesSelected(keyframe) {
			this.emit('selected', keyframe);
		}

		let subscriptions = [];
		// on event.
		this.on = function (topic, callback) {
			if (!callback) {
				return;
			}

			subscriptions.push({ topic: topic, callback: callback });
		}

		// emit event.
		this.emit = function (topic, args) {
			for (var i = subscriptions.length - 1; i >= 0; i--) {
				var sub = subscriptions[i];
				if (sub.topic == topic && sub.callback) {
					sub.callback(args);
				}
			}
		}

		// remove event.
		this.remove = function (topic, callback) {
			for (var i = subscriptions.length - 1; i >= 0; i--) {
				var sub = subscriptions[i];
				if (sub.topic == topic && sub.callback == callback) {
					subscriptions = subscriptions.filter(function (ele) {
						return ele != value;
					});
				}
			}
		}

		return this;
	}

	return this;
}(window, document);
