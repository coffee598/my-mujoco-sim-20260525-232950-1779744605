
import * as THREE           from 'three';
import { GUI              } from '../node_modules/three/examples/jsm/libs/lil-gui.module.min.js';
import { OrbitControls    } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { DragStateManager } from './utils/DragStateManager.js';
import { setupGUI, downloadExampleScenesFolder, loadSceneFromURL, drawTendonsAndFlex, getPosition, getQuaternion, toMujocoPos, standardNormal } from './mujocoUtils.js';
import   load_mujoco        from '../node_modules/mujoco-js/dist/mujoco_wasm.js';

// Load the MuJoCo Module
const mujoco = await load_mujoco();

// Set up Emscripten's Virtual File System
var initialScene = "unitree_g1.xml";
mujoco.FS.mkdir('/working');
mujoco.FS.mount(mujoco.MEMFS, { root: '.' }, '/working');
mujoco.FS.writeFile("/working/" + initialScene, await(await fetch("./assets/scenes/" + initialScene)).text());

export class MuJoCoDemo {
  constructor() {
    this.mujoco = mujoco;

    // Model will be loaded in init() after assets are downloaded
    this.model = null;
    this.data  = null;

    // Define Random State Variables
    this.params = { scene: initialScene, paused: false, help: false, ctrlnoiserate: 0.0, ctrlnoisestd: 0.0, keyframeNumber: 0 };
    this.mujoco_time = 0.0;
    this.bodies  = {}, this.lights = {};
    this.tmpVec  = new THREE.Vector3();
    this.tmpQuat = new THREE.Quaternion();
    this.updateGUICallbacks = [];

    this.container = document.createElement( 'div' );
    document.body.appendChild( this.container );

    this.scene = new THREE.Scene();
    this.scene.name = 'scene';

    this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.001, 100 );
    this.camera.name = 'PerspectiveCamera';
    this.camera.position.set(2.0, 1.7, 1.7);
    this.scene.add(this.camera);

    this.scene.background = new THREE.Color(0.15, 0.25, 0.35);
      this.sunlight = new THREE.DirectionalLight(0xffffff, 1.0 * 3.14 * 4.0);
  
      const brightness = 40; // 0..100
      const intensity = (brightness / 100) * 12.56; // 12.56 ≈ 4 * 3.14
      this.sunlight.intensity = intensity;
  
      this.sunlight.castShadow = true;
      this.sunlight.shadow.mapSize.width = 1024;
      this.sunlight.shadow.mapSize.height = 1024;
      this.sunlight.shadow.camera.near = 0.1;
      this.sunlight.shadow.camera.far = 100;
      this.sunlight.position.set(3, 6, 3);
      const targetObject = new THREE.Object3D();
      this.scene.add(targetObject);
      this.sunlight.target = targetObject;
      targetObject.position.set(0, 1, 0);
      this.scene.add(this.sunlight);

    const logoWidth = 3220;
      const logoHeight = 678;
      const floorHeight = 2.0;
      const floorWidth = (floorHeight * (logoWidth / logoHeight))+0.0;
      this.floorTexture = new THREE.TextureLoader().load('./assets/roba_logo.png');
      this.floorTexture.wrapS = THREE.ClampToEdgeWrapping;
      this.floorTexture.wrapT = THREE.ClampToEdgeWrapping;
      this.floorTexture.generateMipmaps = true;
      this.floorTexture.minFilter = THREE.LinearMipmapLinearFilter;
      this.floorTexture.magFilter = THREE.LinearFilter;
      this.floorTexture.colorSpace = THREE.SRGBColorSpace;
      const floorMaterial = new THREE.MeshStandardMaterial({
        map: this.floorTexture,
        side: THREE.DoubleSide,
        roughness: 1.5,
        metalness: 1.0,
        transparent: true,
        alphaTest: 0.01
      });
      const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorHeight);
      const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.y = 0.03;
      floorMesh.position.z = -3.0;
      floorMesh.receiveShadow = true;
      this.scene.add(floorMesh);


    this.renderer = new THREE.WebGLRenderer( { antialias: true } );
    this.renderer.setPixelRatio(1.0);////window.devicePixelRatio );
    this.renderer.setSize( window.innerWidth, window.innerHeight );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
    THREE.ColorManagement.enabled = false;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    //this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    //this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    //this.renderer.toneMappingExposure = 2.0;
    this.renderer.useLegacyLights = true;

    this.renderer.setAnimationLoop( this.render.bind(this) );

    this.container.appendChild( this.renderer.domElement );

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.7, 0);
    this.controls.panSpeed = 2;
    this.controls.zoomSpeed = 1;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.10;
    this.controls.screenSpacePanning = true;
    this.controls.update();

    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Initialize the Drag State Manager.
    this.dragStateManager = new DragStateManager(this.scene, this.renderer, this.camera, this.container.parentElement, this.controls);
  }

  async init() {
    // Show loading indicator
    let loadingDiv = document.createElement('div');
    loadingDiv.id = 'mujoco-loading';
    loadingDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:rgba(255,255,255,0.7);font:14px -apple-system,sans-serif;text-align:center;z-index:99999;';
    loadingDiv.innerHTML = '<div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);border-top-color:rgba(255,255,255,0.6);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px;"></div>Loading simulation...<style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(loadingDiv);

    try {
      // Download the the examples to MuJoCo's virtual file system
      this.sceneFiles = await downloadExampleScenesFolder(mujoco);

      // Initialize the three.js Scene using the .xml Model in initialScene
      [this.model, this.data, this.bodies, this.lights] =
        await loadSceneFromURL(mujoco, initialScene, this);

      this.gui = new GUI();
      setupGUI(this);
    } catch (e) {
      console.error("[MuJoCo] Failed to initialize:", e);
      loadingDiv.style.color = '#ff4444';
      loadingDiv.innerHTML = '<b>MuJoCo Error</b><br><br>' + (e.message || e);
      return;
    }
    loadingDiv.remove();
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize( window.innerWidth, window.innerHeight );
  }

  render(timeMS) {
    this.controls.update();

    // Don't render until model is loaded
    if (!this.model || !this.data) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (!this.params["paused"]) {
      let timestep = this.model.opt.timestep;
      if (timeMS - this.mujoco_time > 35.0) { this.mujoco_time = timeMS; }
      while (this.mujoco_time < timeMS) {

        // Automatic car animation for car scene
        if (this.params["scene"] === "car.xml") {
          const cycleTime = 6.0; // Total cycle time in seconds
          const phase = (this.data.time % cycleTime);

          if (phase < 0.5) {
            // Start: stationary
            this.data.ctrl[0] = 0;
          } else if (phase < 2.5) {
            // Backward phase (reverse first)
            this.data.ctrl[0] = -0.8;
          } else if (phase < 3.0) {
            // Slow down
            this.data.ctrl[0] = 0;
          } else if (phase < 3.5) {
            // Brief pause
            this.data.ctrl[0] = 0;
          } else if (phase < 5.5) {
            // Forward phase
            this.data.ctrl[0] = 0.8;
          } else {
            // Stop
            this.data.ctrl[0] = 0;
          }
          // Keep steering at 0
          if (this.data.ctrl.length > 1) {
            this.data.ctrl[1] = 0;
          }
        }

        // ── G1 Table-Lift Animation ──────────────────────────────────────────
        // 21-second cycle with 8 phases:
        //   0.0 –  1.5 s : stand neutral
        //   1.5 –  3.5 s : waist turns toward table (+Y), legs settle
        //   3.5 –  5.5 s : walk forward phase 1 – modest stride, closes most of gap
        //   5.5 –  7.5 s : walk forward phase 2 – bigger stride, closes final gap
        //   7.5 –  9.5 s : arms reach forward-down, hands close to grasp
        //   9.5 – 12.0 s : arms sweep overhead fully extended (lift)
        //  12.0 – 15.0 s : hold aloft
        //  15.0 – 19.0 s : smooth return to neutral for next cycle
        //  19.0 – 21.0 s : stand neutral pause before loop
        if (this.params["scene"] === "unitree_g1.xml") {
          const cycleTime = 21.0;
          const t = this.data.time % cycleTime;

          // Cubic ease-in-out between simulation time bounds [a, b]
          const smoothstep = (a, b, v) => {
            const x = Math.max(0.0, Math.min(1.0, (v - a) / (b - a)));
            return x * x * (3.0 - 2.0 * x);
          };

          // Phase blend weights
          const wTurn    = smoothstep(1.5,  3.5,  t);  // waist yaw ramps up
          const wWalk    = smoothstep(3.5,  5.5,  t);  // walk forward phase 1 – modest stride
          const wWalk2   = smoothstep(5.5,  7.5,  t);  // walk forward phase 2 – bigger stride, closes final gap
          const wGrasp   = smoothstep(7.5,  9.5,  t);  // arms reach + hands close
          const wLift    = smoothstep(9.5,  12.0, t);  // arms sweep to overhead
          const wReturn  = smoothstep(15.0, 19.0, t);  // everything back to 0

          const active   = 1.0 - wReturn;              // general "not returning" weight

          // ── APPROACH – physically translate root body toward the table ─────
          // During the walk phase (3.5–5.5 s) the robot animates a stepping gait
          // AND its root qpos is smoothly pushed 0.55 m forward along the +Y world
          // axis (the direction the waist has already turned toward).  The offset
          // is held at full value through grasp & lift so the robot stays close,
          // then fades back to zero with wReturn so each cycle restarts at origin.
          // qpos free-joint layout: [0]=x  [1]=y  [2]=z  [3-6]=quaternion
          const approachDist  = 0.55;                    // metres to step toward table
          // Hold peak offset through grasp+lift; fade back to 0 with wReturn.
          const yHold         = Math.min(wWalk, 1.0);   // 0→1 during walk, stays 1
          this.data.qpos[1]   = approachDist * (yHold - wReturn) * active;

          // ── WALK FORWARD – alternating hip-pitch gait during approach ──────
          // Oscillate at 2 Hz for 2 s → ≈4 half-steps.  Phase frozen once wWalk=1.
          const walkPhase = Math.min(t - 3.5, 2.0) * Math.PI * 2.0; // 0 → 4π
          const stepSwing = Math.sin(walkPhase) * wWalk * active;    // ±1 swing osc.

          // Hip-pitch stride: one leg swings forward while the other pushes back.
          // Magnitude is modest (0.25 rad) so the robot shuffles rather than sprints.
          const strideAmp = 0.25;
          const hipFwdL   =  strideAmp * stepSwing;   // L hip pitches forward on +sin
          const hipFwdR   = -strideAmp * stepSwing;   // R hip pitches forward on -sin

          // Knee flexion matches the striding leg to keep foot clearing ground.
          const kneeFwdL  =  Math.max(0,  stepSwing) * 0.3 * wWalk * active;
          const kneeFwdR  =  Math.max(0, -stepSwing) * 0.3 * wWalk * active;

          // Ankle compensation keeps the foot roughly level.
          const ankleFwdL = -hipFwdL * 0.4 * wWalk * active;
          const ankleFwdR = -hipFwdR * 0.4 * wWalk * active;

          // ── WAIST ────────────────────────────────────────────────────────
          // [12] waist_yaw  : turn ~1.4 rad to face the table at +Y
          // [13] waist_roll : neutral
          // [14] waist_pitch: lean forward slightly while reaching
          this.data.ctrl[12] = 1.4  * wTurn   * active;
          this.data.ctrl[13] = 0.0;
          this.data.ctrl[14] = 0.25 * wGrasp  * (1.0 - wLift) * active;

          // ── LEGS – walk approach, then shallow squat while reaching, extend for lift ──
          const squat = 0.35 * wGrasp * (1.0 - wLift) * active;
          // Left  (walk stride + grasp squat blended together)
          this.data.ctrl[0]  = -squat + hipFwdL;              // L_hip_pitch
          this.data.ctrl[1]  =  0.05 * active;                // L_hip_roll (slight abduct)
          this.data.ctrl[2]  =  0.0;                          // L_hip_yaw
          this.data.ctrl[3]  =  squat * 1.6 + kneeFwdL;      // L_knee
          this.data.ctrl[4]  = -squat * 0.6 + ankleFwdL;     // L_ankle_pitch
          this.data.ctrl[5]  =  0.0;                          // L_ankle_roll
          // Right (mirror)
          this.data.ctrl[6]  = -squat + hipFwdR;              // R_hip_pitch
          this.data.ctrl[7]  = -0.05 * active;                // R_hip_roll
          this.data.ctrl[8]  =  0.0;                          // R_hip_yaw
          this.data.ctrl[9]  =  squat * 1.6 + kneeFwdR;      // R_knee
          this.data.ctrl[10] = -squat * 0.6 + ankleFwdR;     // R_ankle_pitch
          this.data.ctrl[11] =  0.0;                          // R_ankle_roll

          // ── ARMS ─────────────────────────────────────────────────────────
          // Reach phase : shoulder pitch ~1.3 rad (forward-down), elbow ~0.9 (bent)
          // Lift  phase : shoulder pitch →-2.8 rad (overhead), elbow → 0 (extended)
          const shPitch    =  1.3  * wGrasp * (1.0 - wLift)
                            + (-2.8) * wLift * active;
          const shRollL    =  0.3  * wGrasp * (1.0 - wLift * 0.7) * active;
          const shRollR    = -0.3  * wGrasp * (1.0 - wLift * 0.7) * active;
          const elbowBend  =  0.9  * wGrasp * (1.0 - wLift) * active;
          const wristPitch = -0.4  * wGrasp * (1.0 - wLift) * active;
          const shYawInner =  0.2  * wGrasp * (1.0 - wLift) * active;

          // Left arm  [15-21]
          this.data.ctrl[15] = shPitch;
          this.data.ctrl[16] = shRollL;
          this.data.ctrl[17] = shYawInner;
          this.data.ctrl[18] = elbowBend;
          this.data.ctrl[19] = 0.0;
          this.data.ctrl[20] = wristPitch;
          this.data.ctrl[21] = 0.0;

          // Right arm [29-35]
          this.data.ctrl[29] = shPitch;
          this.data.ctrl[30] = shRollR;
          this.data.ctrl[31] = -shYawInner;
          this.data.ctrl[32] = elbowBend;
          this.data.ctrl[33] = 0.0;
          this.data.ctrl[34] = wristPitch;
          this.data.ctrl[35] = 0.0;

          // ── HANDS – open while reaching, close to grip, open on return ────
          // Grip closes after arms are positioned (t > 6.2 s) and before return
          const grip = smoothstep(6.2, 7.5, t) * active;

          // Left hand [22-28]
          // Ranges: thumb0[-1.047,1.047] thumb1[-0.724,1.047] thumb2[0,1.745]
          //         middle0[-1.571,0]    middle1[-1.745,0]
          //         index0 [-1.571,0]    index1 [-1.745,0]
          this.data.ctrl[22] =  0.9  * grip;   // L_thumb0  (+ve = away from palm)
          this.data.ctrl[23] =  0.9  * grip;   // L_thumb1
          this.data.ctrl[24] =  1.5  * grip;   // L_thumb2  (+ve = curl inward)
          this.data.ctrl[25] = -1.4  * grip;   // L_middle0 (-ve = curl inward)
          this.data.ctrl[26] = -1.5  * grip;   // L_middle1
          this.data.ctrl[27] = -1.4  * grip;   // L_index0
          this.data.ctrl[28] = -1.5  * grip;   // L_index1

          // Right hand [36-42]
          // Ranges: thumb0[-1.047,1.047] thumb1[-1.047,0.724] thumb2[-1.745,0]
          //         middle0[0,1.571]     middle1[0,1.745]
          //         index0 [0,1.571]     index1 [0,1.745]
          this.data.ctrl[36] = -0.9  * grip;   // R_thumb0  (-ve = away from palm, mirrored)
          this.data.ctrl[37] = -0.9  * grip;   // R_thumb1
          this.data.ctrl[38] = -1.5  * grip;   // R_thumb2  (-ve = curl inward)
          this.data.ctrl[39] =  1.4  * grip;   // R_middle0 (+ve = curl inward)
          this.data.ctrl[40] =  1.5  * grip;   // R_middle1
          this.data.ctrl[41] =  1.4  * grip;   // R_index0
          this.data.ctrl[42] =  1.5  * grip;   // R_index1
        }
        // ── End G1 Table-Lift Animation ──────────────────────────────────────

        // Jitter the control state with gaussian random noise
        if (this.params["ctrlnoisestd"] > 0.0) {
          let rate  = Math.exp(-timestep / Math.max(1e-10, this.params["ctrlnoiserate"]));
          let scale = this.params["ctrlnoisestd"] * Math.sqrt(1 - rate * rate);
          let currentCtrl = this.data.ctrl;
          for (let i = 0; i < currentCtrl.length; i++) {
            currentCtrl[i] = rate * currentCtrl[i] + scale * standardNormal();
            this.params["Actuator " + i] = currentCtrl[i];
          }
        }

        // Clear old perturbations, apply new ones.
        for (let i = 0; i < this.data.qfrc_applied.length; i++) { this.data.qfrc_applied[i] = 0.0; }
        let dragged = this.dragStateManager.physicsObject;
        if (dragged && dragged.bodyID) {
          for (let b = 0; b < this.model.nbody; b++) {
            if (this.bodies[b]) {
              getPosition  (this.data.xpos , b, this.bodies[b].position);
              getQuaternion(this.data.xquat, b, this.bodies[b].quaternion);
              this.bodies[b].updateWorldMatrix();
            }
          }
          let bodyID = dragged.bodyID;
          this.dragStateManager.update(); // Update the world-space force origin
          let force = toMujocoPos(this.dragStateManager.currentWorld.clone().sub(this.dragStateManager.worldHit).multiplyScalar(this.model.body_mass[bodyID] * 250));
          let point = toMujocoPos(this.dragStateManager.worldHit.clone());
          mujoco.mj_applyFT(this.model, this.data, [force.x, force.y, force.z], [0, 0, 0], [point.x, point.y, point.z], bodyID, this.data.qfrc_applied);

          // TODO: Apply pose perturbations (mocap bodies only).
        }

        mujoco.mj_step(this.model, this.data);

        this.mujoco_time += timestep * 1000.0;
      }

    } else if (this.params["paused"]) {
      this.dragStateManager.update(); // Update the world-space force origin
      let dragged = this.dragStateManager.physicsObject;
      if (dragged && dragged.bodyID) {
        let b = dragged.bodyID;
        getPosition  (this.data.xpos , b, this.tmpVec , false); // Get raw coordinate from MuJoCo
        getQuaternion(this.data.xquat, b, this.tmpQuat, false); // Get raw coordinate from MuJoCo

        let offset = toMujocoPos(this.dragStateManager.currentWorld.clone()
          .sub(this.dragStateManager.worldHit).multiplyScalar(0.3));
        if (this.model.body_mocapid[b] >= 0) {
          // Set the root body's mocap position...
          console.log("Trying to move mocap body", b);
          let addr = this.model.body_mocapid[b] * 3;
          let pos  = this.data.mocap_pos;
          pos[addr+0] += offset.x;
          pos[addr+1] += offset.y;
          pos[addr+2] += offset.z;
        } else {
          // Set the root body's position directly...
          let root = this.model.body_rootid[b];
          let addr = this.model.jnt_qposadr[this.model.body_jntadr[root]];
          let pos  = this.data.qpos;
          pos[addr+0] += offset.x;
          pos[addr+1] += offset.y;
          pos[addr+2] += offset.z;
        }
      }

      mujoco.mj_forward(this.model, this.data);
    }

    // Update body transforms.
    for (let b = 0; b < this.model.nbody; b++) {
      if (this.bodies[b]) {
        getPosition  (this.data.xpos , b, this.bodies[b].position);
        getQuaternion(this.data.xquat, b, this.bodies[b].quaternion);
        this.bodies[b].updateWorldMatrix();
      }
    }

    // Update light transforms.
    for (let l = 0; l < this.model.nlight; l++) {
      if (this.lights[l]) {
        getPosition(this.data.light_xpos, l, this.lights[l].position);
        getPosition(this.data.light_xdir, l, this.tmpVec);
        this.lights[l].lookAt(this.tmpVec.add(this.lights[l].position));
      }
    }

    // Draw Tendons and Flex verts
    drawTendonsAndFlex(this.mujocoRoot, this.model, this.data);

    // Render!
    this.renderer.render( this.scene, this.camera );
  }
}

let demo = new MuJoCoDemo();
await demo.init();
