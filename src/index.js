import * as THREE from "three";
import * as CANNON from "cannon";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';

import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import CHARACTER_FBX from "./assets/kenney/characterLargeMale.fbx";
import RUN_FBX from "./assets/kenney/anim/run.fbx";
import WALK_FBX from "./assets/kenney/anim/walk.fbx";
import JUMP_FBX from "./assets/kenney/anim/jump.fbx";
import IDLE_FBX from "./assets/kenney/anim/idle.fbx";
import DEATH_FBX from "./assets/kenney/anim/death.fbx";
import KICK_FBX from "./assets/kenney/anim/kick.fbx";

const ANIMS = [
    {fbx:RUN_FBX, name:"run", idx:1,play:false,loop:true},
    {fbx:WALK_FBX, name:"walk", idx:0,play:false,loop:true},
    {fbx:JUMP_FBX, name:"jump", idx:0,play:false,loop:false}, 
    {fbx:IDLE_FBX, name:"idle", idx:0,play:false,loop:true},
    {fbx:DEATH_FBX, name:"death", idx:0,play:false,loop:false},
    {fbx:KICK_FBX, name:"kick", idx:0,play:false,loop:false},
]

function init(){
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

    const WALK_SPEED = 4;
    const RUN_SPEED = WALK_SPEED * 3;
    const JUMP_VELOCITY = 8;
    const CUBE_WAIT = 0.25;
    const WORLD_RADIUS = 100
    var cubeTimer = 0;

    // Scene Lighting
    scene.fog = new THREE.Fog( 0x000000, 0, 500 );
    var ambient = new THREE.AmbientLight( 0xeeeeee );
    scene.add( ambient );
    var light = new THREE.PointLight( 0xffffff, 1, 100 );
    light.position.set( 10, 30, 20 );
    light.castShadow = true;
    scene.add( light );

    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );

    var clock = new THREE.Clock();

    var effect = new OutlineEffect( renderer );

    var world = new CANNON.World();
    const GRAVITY = -9.82;
    world.gravity.set(0,GRAVITY,0);

    // Create Cube
    function spawnCube(x,y,z){
        var geometry = new THREE.BoxGeometry();
        var material = new THREE.MeshLambertMaterial( { color: 0xdddddd } ); 
        var cube = new THREE.Mesh( geometry, material );
        cube.castShadow = true;
        scene.add( cube )
        var body = new CANNON.Body({
            mass: 5,
            position: new CANNON.Vec3(x,y,z),
            shape: new CANNON.Box(new CANNON.Vec3(0.5,0.5,0.5)),
        })
        world.addBody( body);
        body.mesh = cube;
    }
    //spawnCube(0,5,0)
    //setInterval(function(){ spawnCube(Math.random(),15,Math.random()) },2000);

    // Load Model
    var loader = new FBXLoader();
    var mixer = null;
    var character = null;
    var playerBod = null
    var canJump = false;
    var isJumping = false;
    var player_actions = {
        unpauseAll: function(){
            for(var k in this.actions){
                this.actions[k].paused = false;
            }
        },
        actions: {},
        active: null,
        played: [],
        isPlaying: function(anim_name){
            return this.actions[anim_name] != undefined && this.active == this.actions[anim_name];
        },
        play: function(action_name,blend_time){
            if(this.actions[action_name] == this.active){ return; }
            this.unpauseAll();
            if(this.active == null){
                this.actions[action_name].play();
            }else{
                if( this.played.includes(action_name) ){
                    this.actions[action_name].reset()
                }else{ 
                    this.actions[action_name].play()
                    this.played.push(action_name)
                }
                this.actions[action_name].crossFadeFrom(this.active,blend_time).play()
            }
            this.active = this.actions[action_name]
        }
    }
    var playerMaterial = new THREE.MeshLambertMaterial( { color: 0xffeeff } );
    loader.load( CHARACTER_FBX, function ( fbx ) {
        character = fbx;
        character.traverse( function ( child ) {
            if ( child.isMesh ) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        } );
        character.scale.set(0.01,0.01,0.01)
        playerBod = new CANNON.Body({
            mass: 5,
            position: new CANNON.Vec3(0,5,0),
            shape: new CANNON.Box(new CANNON.Vec3(0.5,3,0.5)),
            type: CANNON.Body.KINEMATIC,
            name: 'player'
        })
        playerBod.floorLevel = 2;
        playerBod.mesh = character

        // From https://schteppe.github.io/cannon.js/examples/js/PointerLockControls.js
        var contactNormal = new CANNON.Vec3();
        var upAxis = new CANNON.Vec3(0,1,0)
        playerBod.addEventListener("collide",function(e){
            console.log(e)
           if(e.contact.bi.id == playerBod.id){
               e.contact.ni.negate(contactNormal)
           }else{
               contactNormal.copy(e.contact.ni)
           }
           if(contactNormal.dot(upAxis) > 0.5){
               console.log("Vertical collision")
               canJump = true
               playerBox.velocity.y = 0;
           }

        });

        console.log(character)
        // TODO custom set color
        //character.children[1].material = new THREE.MeshPhongMaterial( {color: 0xffeeff });
        world.addBody( playerBod );
        scene.add( character );
            
        mixer = new THREE.AnimationMixer( character );

        // Then load walk animation
        ANIMS.forEach( a => {
            loader.load(a.fbx, function ( anim ) {
                character.animations.push(anim.animations[a.idx]);
                player_actions.actions[a.name] = mixer.clipAction( anim.animations[a.idx] );
                if(!a.loop){
                    player_actions.actions[a.name].setLoop(THREE.LoopOnce);
                }
                if(a.play){
                    player_actions.actions[a.name].play()
                }
            } );
        })
    } );


    // Create a plane
    var groundBody = new CANNON.Body({
        mass: 0, // mass == 0 makes the body static
        position: new CANNON.Vec3(0,2,0)
    });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0),-Math.PI/2); // rotate up 
    var groundShape = new CANNON.Plane();
    groundBody.addShape(groundShape);
    world.addBody(groundBody);
    var geometry = new THREE.PlaneGeometry( 1000, 1000, 50, 50 );
    var groundMaterial = new THREE.MeshLambertMaterial( { color: 0x111111 } );
    var groundMesh = new THREE.Mesh( geometry, groundMaterial );
    groundMesh.receiveShadow = true;
    groundMesh.position.copy(groundBody.position)
    groundMesh.quaternion.copy(groundBody.quaternion)
    scene.add( groundMesh );

    var timestep = 1.0 / 60.0; 

    camera.position.set(5,10,-10);
    camera.lookAt(new THREE.Vector3(0,0,0));

    var controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 10;
    controls.maxDistance = 100;

    function removeBody(body){
        if(body.mesh != undefined){
            scene.remove(body.mesh)
        }
        world.removeBody(body)
    }

    function updatePhysics(delta){
        world.step(delta);
        world.bodies.forEach( b => {
            if(b.name != 'player' && b.position.distanceTo(new CANNON.Vec3(0,0,0)) > WORLD_RADIUS){
                removeBody(b)
                return 
            }
            if(b.mesh != undefined){
                b.mesh.position.copy(b.position)
                b.mesh.quaternion.copy(b.quaternion)
            }
        })                    
    }

    // kevin's player ctrls
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();

    // Click to walk/run to point
    function setMouseTarget( event ){
	    mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    }
    function onMouseClick( event ){
        playerCtl.run = false
        setMouseTarget(event);
    }
    window.addEventListener( 'click', onMouseClick )
    function onMouseDblClick( event ){
        playerCtl.run = true
        setMouseTarget(event)
    }
    window.addEventListener( 'dblclick', onMouseDblClick )

    /*
    function onMouseMove( event ) {
	    mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
        return event;
    }
    window.addEventListener( 'mousemove', onMouseMove );
    */
    /*
    function onMouseDown( event ){ playerCtl.jump = true; }
    function onMouseUp( event ){ playerCtl.jump = false}
    window.addEventListener( 'mousedown', onMouseDown );
    window.addEventListener( 'mouseup', onMouseUp );
    */

    document.getElementById("dropCubeButton").addEventListener('click', e=> { 
        spawnCube(0,10,0); 
        e.stopPropagation();
    })
    document.getElementById("jumpButton").addEventListener('click', e=> { 
        playerCtl.jump = true;
        e.stopPropagation()
    })

    var playerCtl = {fwd: false, back: false, left: false, right: false};
    function updatePlayer(delta) {
        if(character == null){ return; }

        raycaster.setFromCamera( mouse, camera );
        var intersects = raycaster.intersectObjects( [groundMesh] );

        var tooClose = false;
        if(intersects.length > 0 ){
            const p = intersects[0].point;

            if( character.position.distanceTo(p) < 1){
                tooClose = true;
            } 
            character.lookAt(new THREE.Vector3(p.x,playerBod.position.y,p.z))
            playerBod.quaternion.copy(character.quaternion)
        }

        var dir = new THREE.Vector3(0,0,0);

        if( !tooClose ){
            dir.z = 1;
        }else{
            // disable run if we have arrived
            if(playerCtl.run){
                playerCtl.run = false;
            }
        }

        if(playerCtl.jump && canJump){
            player_actions.play("jump",0.1)
            playerBod.velocity.y = JUMP_VELOCITY
            canJump = false
            isJumping = true
            playerCtl.jump = false
        }else{
            playerBod.velocity.y += GRAVITY * delta
        }

        dir.applyQuaternion( character.quaternion )
        // TODO better version: https://threejs.org/examples/webgl_animation_skinning_blending
        if(dir.length() > 0){
           if(playerCtl.run){
                dir = dir.multiplyScalar( RUN_SPEED * delta  )
                if(!isJumping){ player_actions.play('run',0.25) }
            }else{
                dir = dir.multiplyScalar( WALK_SPEED * delta )
                if(!isJumping){ player_actions.play('walk',0.25) }
            }
            // No y for now
            playerBod.position.x += dir.x;
            playerBod.position.z += dir.z;

        }else if( !player_actions.isPlaying("death") ){
            player_actions.play('idle',0.25)
        }

        if(playerBod.velocity.y != 0){
            // Kinematic bodies don't have collision events with
            // static bodies, so instead we track floorLevel manually
            // to stop a fall
            if(playerBod.position.y <= playerBod.floorLevel && playerBod.velocity.y < 0){
                playerBod.position.y = playerBod.floorLevel 
                playerBod.velocity.y = 0
                canJump = true
                isJumping = false
            }else{
                playerBod.position.y += playerBod.velocity.y * delta
                playerBod.velocity.y += GRAVITY * delta
            }
        }else{
            playerBod.velocity.y = 0
        }
    }

    window.addEventListener("keydown", function(e) {
        
        switch(e.key) {
            case 'w':
                playerCtl.fwd = true;
            break;
            case 's':
                playerCtl.back = true;
            break;
            case 'a':
                playerCtl.left = true;
            break;
            case 'd':
                playerCtl.right = true;
            break;
            case ' ':
                playerCtl.jump = true;
            break;
            case 'Shift':
                playerCtl.run = true;
            break
            case 'q':
                if( cubeTimer <= 0){
                    spawnCube(0,15,0);
                    cubeTimer = CUBE_WAIT;
                }else{
                    console.log(cubeTimer);
                }
            break;
        }
    });
    window.addEventListener("keyup", function(e) {
        
        switch(e.key) {
            case 'w':
                playerCtl.fwd = false;
            break;
            case 's':
                playerCtl.back = false;
            break;
            case 'a':
                playerCtl.left = false;
            break;
            case 'd':
                playerCtl.right = false;
            break;
            case ' ':
                playerCtl.jump = false;
            break;
            case 'Shift':
                playerCtl.run = false;
            break;
        }
    });


    function animate() {
        requestAnimationFrame( animate );            
        const delta = clock.getDelta();
        if(mixer != null){
            mixer.update(delta);
        }
        updatePlayer(delta);
        updatePhysics(delta);
        if(cubeTimer > 0){
            cubeTimer -= delta;
        }
    	effect.render( scene, camera );
    }
    animate();
}

init();