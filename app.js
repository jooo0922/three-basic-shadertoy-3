'use strict';

import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/build/three.module.js';

function main() {
  // create WebGLRenderer
  const canvas = document.querySelector('#canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas
  });

  // create camera
  const fov = 75;
  const aspect = 2;
  const near = 0.1;
  const far = 5;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.z = 2;

  // create scene
  const scene = new THREE.Scene();

  // 큐브 메쉬를 만들 때 사용하는 박스 지오메트리를 생성해놓음
  const boxWidth = 1;
  const boxHeight = 1;
  const boxDepth = 1;
  const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);

  // 아래에서 로드한 텍스처를 받아서 사용하는 쉐이더토이를 가져옴.
  // 이번 예제에서는 mainImage 함수에서 받는 vec2 fragCoord 좌표값을 캔버스의 각 픽셀의 좌표값으로 받는 것이 아닌,
  // 해당 쉐이더가 적용되는 ShaderMaterial로 만든 큐브 메쉬의 각 삼각형 버텍스 사이를 보간한(점진적으로 채운, varied한) 좌표값들을 순차적으로 넣어주려는 것!
  // 따라서, fragmentShader에 vertexShader에서 넘겨준 좌표값들을 받는 varying 타입의 vec2 변수를 추가해주고,
  // 그 좌표값에 iResolution을 곱해준 값을 fragCoord로 전달해주도록 할거임. 이때, uniforms 균등변수에서도 iResolution을 (1, 1, 1)값으로 지정해 놓음으로써 결국 1을 곱하면 자기 자신, 즉 vUv 값이 그대로 fragCoord에 들어가도록 함.
  // 이처럼 fragCoord에 들어갈 좌표값을 캔버스의 픽셀 좌표값이 아닌, 삼각형의 버텍스를 보간한 텍스처 좌표값으로 넣어줌으로써 쉐이더 함수를 텍스처처럼 사용하는 기법을 '절차적 텍스처'라고 함.
  const fragmentShader = `
  #include <common>

  uniform vec3 iResolution;
  uniform float iTime;
  uniform sampler2D iChannel0;

  // By Daedelus: https://www.shadertoy.com/user/Daedelus
  // license: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
  #define TIMESCALE 0.25 
  #define TILES 8
  #define COLOR 0.7, 1.6, 2.8

  void mainImage( out vec4 fragColor, in vec2 fragCoord )
  {
    vec2 uv = fragCoord.xy / iResolution.xy;
    uv.x *= iResolution.x / iResolution.y;
    
    vec4 noise = texture2D(iChannel0, floor(uv * float(TILES)) / float(TILES));
    float p = 1.0 - mod(noise.r + noise.g + noise.b + iTime * float(TIMESCALE), 1.0);
    p = min(max(p * 3.0 - 1.8, 0.1), 2.0);
    
    vec2 r = mod(uv * float(TILES), 1.0);
    r = vec2(pow(r.x - 0.5, 2.0), pow(r.y - 0.5, 2.0));
    p *= 1.0 - pow(min(1.0, 12.0 * dot(r, r)), 2.0);
    
    fragColor = vec4(COLOR, 1.0) * p;
  }

  varying vec2 vUv;

  void main() {
    // mainImage(gl_FragColor, gl_FragCoord.xy);
    mainImage(gl_FragColor, vUv * iResolution.xy);
  }
  `;

  // fragmentShader에 메쉬의 각 vertex 사이를 보간한 좌표값을 전달해주는 vertexShader도 만들어 줌
  // 아래에 보이는 몇 가지 변수들은 THREE.JS가 알아서 채워준다고 함. 
  const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `;

  // 쉐이더토이에 사용할 텍스처를 로드해 옴.
  const loader = new THREE.TextureLoader();
  const texture = loader.load('./image/bayer.png');
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter; // 텍스처를 적용하는 원본보다 텍스처가 클 때와 작을 때 모두 NearestFilter를 적용함
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping; // 텍스처의 수평, 수직 반복 유형을 모두 RepeatWrapping 으로 지정함.

  // iResolution값은 더 이상 캔버스의 해상도로 지정하지 않고, (1, 1, 1)값으로 고정해서
  // 정점 사이의 보간된 varying 좌표값에 곱하거나 나누어도 똑같은 값이 나오도록 지정해 줌.
  // 또 이제 iResolution을 animate 함수에서 캔버스가 리사이징 될때마다 바꿔주는 일도 없을거임. 항상 (1, 1, 1)로만 사용할거기 때문에
  const uniforms = {
    iTime: {
      value: 0
    },
    iResolution: {
      value: new THREE.Vector3(1, 1, 1)
    },
    iChannel0: {
      value: texture
    }
  }

  // 이번에는 vertexShader도 같이 넘겨줘서 ShaderMaterial을 생성함.
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms
  });

  // 큐브 메쉬를 생성하여 씬에 추가하고 리턴해주는 함수
  function makeInstance(geometry, x) {
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    cube.position.x = x;

    return cube;
  }

  // makeInstance를 호출하여 리턴받은 큐브 메쉬를 저장해두는 배열. animate 함수에서 각 큐브들을 회전시킬 때 사용할거임.
  const cubes = [
    makeInstance(geometry, 0),
    makeInstance(geometry, -2),
    makeInstance(geometry, 2),
  ];

  // resize renderer
  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }

    return needResize;
  }

  // animate
  function animate(t) {
    t *= 0.001; // 밀리초 단위의 타임스탬프값을 초 단위로 변환

    // 렌더러가 리사이징 되었을 때 변경된 사이즈에 맞게 카메라 비율(aspect)도 업데이트 해줌
    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    // 각각의 큐브 메쉬들의 서로 다른 속도로 rotation 값을 할당하여 회전시켜 줌.
    cubes.forEach((cube, index) => {
      const speed = 1 + index * 0.1;
      const rotate = t * speed;
      cube.rotation.x = rotate;
      cube.rotation.y = rotate;
    })

    // const canvas = renderer.domElement;
    // uniforms.iResolution.value.set(canvas.width, canvas.height, 1); 더 이상 캔버스 해상도를 iResolution에 지정해 줄 필요가 없음. 항상 (1, 1, 1)로만 쓸거니까.

    // 매 프레임마다 타임스탬프값을 iTime에 지정해 줌. 이거는 계속 넘겨줘야 쉐이더 코드가 애니메이션을 만들어 줄테니까.
    uniforms.iTime.value = t;

    renderer.render(scene, camera); // WebGLRenderer를 호출할 때마다 ShaderMaterial이 렌더되어야 하므로, 그때마다 ShaderMaterial 안에 작성한 쉐이더 코드의 함수들이 호출되는 것 같음.

    requestAnimationFrame(animate); // 내부에서 반복 호출
  }

  requestAnimationFrame(animate);
}

main();