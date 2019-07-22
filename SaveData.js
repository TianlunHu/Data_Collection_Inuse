'use strict';
/* globals MediaRecorder */

const mediaSource = new MediaSource();
mediaSource.addEventListener('sourceopen', handleSourceOpen, false);
let mediaRecorder;
let recordedBlobs;
let sourceBuffer;

const errorMsgElement = document.querySelector('span#errorMsg');
const recordButton = document.querySelector('button#record');

recordButton.addEventListener('click', () => {
    if (recordButton.textContent === 'Start Recording') {
        startRecording();
        StartSensor();
    } else {
        stopRecording();
        recordButton.textContent = 'Start Recording';
        downloadButton.disabled = false;
    }
});

const downloadButton = document.querySelector('button#download');
downloadButton.addEventListener('click', () => {
    //Get Time for files' Name.
    const date = new Date();
    const T = date.getMonth() + 1 + '.' + date.getDate() + ' ' + date.getHours() + '-' + date.getMinutes() + '-' + date.getSeconds();

    //Save Sequence as Vodeo
    const blob = new Blob(recordedBlobs, {
        type: 'video/webm'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'Sequence ' + T + '.webm';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);

    //Save Sensor Date as .txt
    const A = AccVec;
    const O = OriVec;
    const TiSt = TsVec;

    const times = new Blob(TiSt, {
        type: "text/plain;charset=utf-8"
    });
    saveAs(times, "TimeStamp  " + T + ".txt");

    const acc = new Blob(A, {
        type: "text/plain;charset=utf-8"
    });
    saveAs(acc, "Acceleration  " + T + ".txt");
    const ori = new Blob(O, {
        type: "text/plain;charset=utf-8"
    });
    saveAs(ori, "orientation  " + T + ".txt");

});

function handleSourceOpen(event) {
    console.log('MediaSource opened');
    sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vp8"');
    console.log('Source buffer: ', sourceBuffer);
}

function handleDataAvailable(event) {
    if (event.data && event.data.size > 0) {
        recordedBlobs.push(event.data);
    }
}

function startRecording() {
    recordedBlobs = [];
    let options = {
        mimeType: 'video/webm;codecs=vp9'
    };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.error(`${options.mimeType} is not Supported`);
        errorMsgElement.innerHTML = `${options.mimeType} is not Supported`;
        options = {
            mimeType: 'video/webm;codecs=vp8'
        };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            console.error(`${options.mimeType} is not Supported`);
            errorMsgElement.innerHTML = `${options.mimeType} is not Supported`;
            options = {
                mimeType: 'video/webm'
            };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.error(`${options.mimeType} is not Supported`);
                errorMsgElement.innerHTML = `${options.mimeType} is not Supported`;
                options = {
                    mimeType: ''
                };
            }
        }
    }

    try {
        mediaRecorder = new MediaRecorder(window.stream, options);
    } catch (e) {
        console.error('Exception while creating MediaRecorder:', e);
        errorMsgElement.innerHTML = `Exception while creating MediaRecorder: ${JSON.stringify(e)}`;
        return;
    }

    console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
    recordButton.textContent = 'Stop Recording';
    downloadButton.disabled = true;
    mediaRecorder.onstop = (event) => {
        console.log('Recorder stopped: ', event);
    };
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.start(10); // collect 10ms of data
    console.log('MediaRecorder started', mediaRecorder);
}

function stopRecording() {
    mediaRecorder.stop();
    accelerometer.stop();
    //gyroscope.stop();
    orientator.stop();
    console.log('Recorded Blobs: ', recordedBlobs);
}

function handleSuccess(stream) {
    recordButton.disabled = false;
    console.log('getUserMedia() got stream:', stream);
    window.stream = stream;

    const gumVideo = document.querySelector('video#gum');
    gumVideo.srcObject = stream;
}

async function init(constraints) {
    try {
        const hasEchoCancellation = document.querySelector('#echoCancellation').checked;
        const constraints = {
            audio: {
                echoCancellation: {
                    exact: hasEchoCancellation
                }
            },
            video: {
                width: 640,
                height: 480
            }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        handleSuccess(stream);
    } catch (e) {
        console.error('navigator.getUserMedia error:', e);
        errorMsgElement.innerHTML = `navigator.getUserMedia error:${e.toString()}`;
    }
}

// ----------------------------------- Sensors ---------------------------------- //
var AccVec = [];
var OriVec = [];
var TsVec = [];
let accelerometer;
let accHighPass;
let accLowPass;
let orientator;
let StartTime;

function calcAngleDegrees(x, y) {
  return Math.atan2(x, y) * 180 / Math.PI;
}
// ------------------ High/Low Pass Filter------------------ // 
class LowPassFilterData {
    constructor(reading, bias) {
        Object.assign(this, {
            x: reading.x,
            y: reading.y,
            z: reading.z
        });
        this.bias = bias;
    }

    update(reading) {
        this.x = this.x * this.bias + reading.x * (1 - this.bias);
        this.y = this.y * this.bias + reading.y * (1 - this.bias);
        this.z = this.z * this.bias + reading.z * (1 - this.bias);
    }
};

class HighPassFilterData {
  constructor(reading, cutoffFrequency) {
    Object.assign(this, { x: reading.x, y: reading.y, z: reading.z });
    this.cutoff = cutoffFrequency;
    this.timestamp = reading.timestamp;
  }

  update(reading) {
    let dt = reading.timestamp / 1000 - this.timestamp / 1000;
    this.timestamp = reading.timestamp;

    for (let i of ["x", "y", "z"]) {
      let alpha = this.cutoff / (this.cutoff + dt);
      this[i] = this[i] + alpha * (reading[i] - this[i]);
    }
  }
};
// -------------------- Call Sensor Function ---------------- // 
function StartSensor() {
    StartTime = Date.now();              
    let Freq = 45;
    AccVec = [];
    OriVec = [];
    TsVec = [];
    // ----------------Motion Sensors (IMU) ---------------- //
    
    function MotionHandler(acceleration, orientation, AV, OV) {
        // ---------- Orientator ----------- //
        let Quater, abcd = "A B C D";
        let Q = orientation.quaternion;
        let x = Q[0];
        let y = Q[1];
        let z = Q[2];
        let w = Q[3];
        Quater = abcd.replace("A", x.toFixed(3));
        Quater = Quater.replace("B", y.toFixed(3));
        Quater = Quater.replace("C", z.toFixed(3));
        Quater = Quater.replace("D", w.toFixed(3));
        document.getElementById("orSen").innerHTML = Quater;
        OV.push(Quater + ' ');
        
        // ---------- Accelerater ----------- //
        let info, xyz = "X Y Z";

        info = xyz.replace("X", acceleration.x && acceleration.x.toFixed(3));
        info = info.replace("Y", acceleration.y && acceleration.y.toFixed(3));
        info = info.replace("Z", acceleration.z && acceleration.z.toFixed(3));
        AV.push(info + ' ');
        document.getElementById('moAccel').innerHTML = info;
        
        // ---------- Visualization ---------- //
        let phi = calcAngleDegrees(2*(w*x+y*z), 1-2*(x*x+y*y));
        let theta = (Math.asin(2*(w*y-z*x)) * 180 / Math.PI);
        let psi = calcAngleDegrees(2*(w*z+x*y), 1-2*(y*y+z*z));
        document.getElementById("phi").innerHTML = phi.toFixed(0);
        document.getElementById("theta").innerHTML = theta.toFixed(0);
        document.getElementById("psi").innerHTML = psi.toFixed(0);
        
        let logo = document.getElementById("imgLogo");
        logo.style.webkitTransform = "rotate(" + (theta) + "deg) rotate3d(1,0,0, " + ((phi) * -1 + 90) + "deg)";
        logo.style.MozTransform = "rotate(" + (theta) + "deg) rotate3d(1,0,0, " + ((phi) * -1 + 90) + "deg)";
        logo.style.transform = "rotate(" + (theta) + "deg) rotate3d(1,0,0, " + ((phi) * -1 + 90) + "deg)";
    }

    if ('LinearAccelerationSensor' in window  && 'DeviceOrientationEvent' in window && 'AbsoluteOrientationSensor' in window) {
        document.getElementById('moApi').innerHTML = 'Motion Sensor detected';
        accelerometer = new LinearAccelerationSensor({
            frequency: Freq
        });
        accHighPass = new HighPassFilterData(accelerometer, 0.8);
        accLowPass = new LowPassFilterData(accHighPass, 0.8);
        
        orientator = new AbsoluteOrientationSensor({
            frequency: Freq
        });
        
        accelerometer.onreading = () => {
            accHighPass.update(accelerometer);
            accLowPass.update(accHighPass);
            MotionHandler(accLowPass, orientator, AccVec, OriVec);
            let current = (accelerometer.timestamp / 1000).toFixed(3);
            document.getElementById("timeStamp").innerHTML = current;
            TsVec.push(current + ' ');
            
        }

        accelerometer.start();
        orientator.start();

    } else if ('DeviceMotionEvent' in window) {
        document.getElementById('moApi').innerHTML = 'Device Motion Event';

        var onDeviceMotion = function (eventData) {
            accelerationHandler(eventData.acceleration, 'moAccel');
            rotationHandler(eventData.rotationRate);
            intervalHandler(eventData.interval);
        }

        window.addEventListener('devicemotion', onDeviceMotion, false);
    } else {
        document.getElementById('logoContainer').innerText = 'Device Orientation API not supported.';
        document.getElementById('moApi').innerHTML = 'No Sensors API available';
        document.getElementById("moRotation").innerHTML = '[x,y,z]';
    }
}
