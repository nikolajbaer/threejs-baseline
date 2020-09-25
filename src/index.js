import * as THREE from "three";
import * as CANNON from "cannon";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';

function init(){
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

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

    var effect = new OutlineEffect( renderer );

    var world = new CANNON.World();
    world.gravity.set(0,-9.82,0);

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
    setInterval(function(){ spawnCube(Math.random(),15,Math.random()) },500);

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

    function animate() {
        requestAnimationFrame( animate );            
        updatePhysics();
    	effect.render( scene, camera );
    }
    animate();

}

init();