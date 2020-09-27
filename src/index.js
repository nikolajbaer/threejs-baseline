import * as THREE from "three";
import * as CANNON from "cannon";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';

import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import CHARACTER_FBX from "./assets/kenney/characterLargeMale.fbx";
import RUN_FBX from "./assets/kenney/anim/walk.fbx";
import WALK_FBX from "./assets/kenney/anim/walk.fbx";
import JUMP_FBX from "./assets/kenney/anim/jump.fbx";
import IDLE_FBX from "./assets/kenney/anim/idle.fbx";
import DEATH_FBX from "./assets/kenney/anim/death.fbx";
import KICK_FBX from "./assets/kenney/anim/kick.fbx";

const ANIMS = [
    {fbx:RUN_FBX, name:"run", idx:1,play:false},
    {fbx:WALK_FBX, name:"walk", idx:0,play:false},
    {fbx:JUMP_FBX, name:"jump", idx:0,play:false}, 
    {fbx:IDLE_FBX, name:"idle", idx:0,play:false},
    {fbx:DEATH_FBX, name:"death", idx:0,play:false},
    {fbx:KICK_FBX, name:"kick", idx:0,play:false},
]

function init(){
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

    const SPEED = 175;
    const JUMP_VELOCITY = 10;

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
    setInterval(function(){ spawnCube(Math.random(),15,Math.random()) },2000);

    // Load Model
    var loader = new FBXLoader();
    var mixer = null;
    var character = null;
    var playerBod = null
    var canJump = false;
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
            console.log("playing ",action_name,this)
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
            position: new CANNON.Vec3(0,2,0),
            shape: new CANNON.Box(new CANNON.Vec3(0.5,3,0.5)),
            type: CANNON.Body.KINEMATIC
        })
        playerBod.mesh = character

        // From https://schteppe.github.io/cannon.js/examples/js/PointerLockControls.js
        var contactNormal = new CANNON.Vec3();
        var upAxis = new CANNON.Vec3(0,1,0)
        playerBod.addEventListener("collide",function(e){

           if(e.contact.bi.id == playerBod.id){
               e.contact.ni.negate(contactNormal)
           }else{
               contactNormal.copy(e.contact.ni)
           }
           if(contactNormal.dot(upAxis) > 0.5){
               canJump = true
               playerBod.velocity.y = 0
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

    function updatePhysics(){
        world.step(timestep);
        world.bodies.forEach( b => {
            if(b.mesh != undefined){
                b.mesh.position.copy(b.position)
                b.mesh.quaternion.copy(b.quaternion)
            }
        })                    
    }


    // kevin's player ctrls
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();

    function onMouseMove( event ) {
	    mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	    mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    }
    window.addEventListener( 'mousemove', onMouseMove );

    var playerCtl = {fwd: false, back: false, left: false, right: false};
    function updatePlayer() {
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
            if (playerCtl.fwd) {
                dir.z = 1;
            }
            if (playerCtl.back) {
                dir.z = -1;
            }
        }

        if(playerCtl.jump && canJump){
            playerBod.velocity.y = JUMP_VELOCITY
            canJump = false
        }

        /*
        if (playerCtl.left) {
            dir.x = 1;
        }
        if (playerCtl.right) {
            dir.x = -1;
        }*/

        dir.applyQuaternion( character.quaternion )
        // TODO better version: https://threejs.org/examples/webgl_animation_skinning_blending
        if(dir.length() > 0){
            dir = dir.multiplyScalar( SPEED * clock.getDelta() )
            // No y for now
            playerBod.position.x += dir.x;
            playerBod.position.z += dir.z;

            player_actions.play('walk',0.25)
        }else if( !player_actions.isPlaying("death") ){
            player_actions.play('idle',0.25)
        }

        if(playerBod.velocity.y != 0){
            playerBod.position.y += playerBod.velocity.y * clock.getDelta()
            playerBod.velocity.y += GRAVITY
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
        }
    });


    function animate() {
        requestAnimationFrame( animate );            
        if(mixer != null){
            var delta = clock.getDelta();
            mixer.update(delta);
        }
        updatePlayer();
        updatePhysics();
    	effect.render( scene, camera );
    }
    animate();
}

init();