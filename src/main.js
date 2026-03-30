import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import gsap from "gsap"
import fragmentShader from "./shaders/fragment.glsl"
import vertexShader from "./shaders/vertex.glsl"

let scene, camera, renderer, sword

const shaderContext = {
  uTime: { value: 0 },
  uBlackout: { value: 0.0 }
}

init()
animate()

function init() {
  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.set(0, -1.5, 8)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  document.body.appendChild(renderer.domElement)

  const mainLight = new THREE.DirectionalLight(0xffffff, 4)
  mainLight.position.set(5, 10, 5)
  scene.add(mainLight)

  const checkLight = new THREE.DirectionalLight(0xffffff, 2)
  checkLight.position.set(-5, -5, -5)
  scene.add(checkLight)

  const rimLight = new THREE.DirectionalLight(0xaabbfc, 4)
  rimLight.position.set(0, 5, -10)
  scene.add(rimLight)

  const ambient = new THREE.AmbientLight(0xffffff, 1.5)
  scene.add(ambient)

  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/")

  const loader = new GLTFLoader()
  loader.setDRACOLoader(dracoLoader)

  const textureLoader = new THREE.TextureLoader()

  const loadTexture = (path, isColor = false) => {
    const tex = textureLoader.load(path)
    tex.flipY = true
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  const katanaColor = loadTexture('/Katana_and_sheath_M_Katana_BaseColor.1001.jpg', true)
  const katanaNormal = loadTexture('/Katana_and_sheath_M_Katana_Normal.1001.jpg')
  const katanaMetallic = loadTexture('/Katana_and_sheath_M_Katana_Metallic.1001.jpg')
  const katanaRoughness = loadTexture('/Katana_and_sheath_M_Katana_Roughness.1001.jpg')
  const katanaHeight = loadTexture('/Katana_and_sheath_M_Katana_Height.1001.jpg')

  const sheathColor = loadTexture('/Katana_and_sheath_M_Sheath_BaseColor.1001.jpg', true)
  const sheathNormal = loadTexture('/Katana_and_sheath_M_Sheath_Normal.1001.jpg')
  const sheathMetallic = loadTexture('/Katana_and_sheath_M_Sheath_Metallic.1001.jpg')
  const sheathRoughness = loadTexture('/Katana_and_sheath_M_Sheath_Roughness.1001.jpg')
  const sheathHeight = loadTexture('/Katana_and_sheath_M_Sheath_Height.1001.jpg')

  loader.load("/katana.glb", (gltf) => {
    sword = gltf.scene

    sword.traverse((child) => {
      const hiddenBoxes = ['Box_1_sheath', 'Box_2_sheath', 'Box_1_Katana', 'Box_2_Katana']

      if (child.isMesh) {
        if (hiddenBoxes.includes(child.name)) {
          child.material = new THREE.MeshBasicMaterial({ visible: false })
        } else {
          let mat = new THREE.MeshStandardMaterial()

          if (child.name === 'KATANA') {
            mat.map = katanaColor
            mat.normalMap = katanaNormal
            mat.metalnessMap = katanaMetallic
            mat.roughnessMap = katanaRoughness
            mat.displacementMap = katanaHeight
            mat.displacementScale = 0.005
          } else if (child.name === 'sheath') {
            mat.map = sheathColor
            mat.normalMap = sheathNormal
            mat.metalnessMap = sheathMetallic
            mat.roughnessMap = sheathRoughness
            mat.displacementMap = sheathHeight
            mat.displacementScale = 0.005
          }

          if (mat.map) {
            mat.onBeforeCompile = (shader) => {
              shader.uniforms.uTime = shaderContext.uTime
              shader.uniforms.uBlackout = shaderContext.uBlackout

              const uniformDecl = `
                #include <common>
                uniform float uTime;
                uniform float uBlackout;
              `

              shader.fragmentShader = shader.fragmentShader.replace('#include <common>', uniformDecl)
              shader.vertexShader = shader.vertexShader.replace('#include <common>', uniformDecl)

              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `#include <dithering_fragment>\n${fragmentShader}`
              )

              shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>\n${vertexShader}`
              )
            }
          }

          child.material = mat
        }
      }
    })

    const box = new THREE.Box3().setFromObject(sword)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    sword.position.sub(center)

    const baseScale = 10 / size.length()
    sword.scale.setScalar(baseScale)
    sword.rotation.set(0, 0, 0)

    scene.add(sword)

    sword.scale.set(-baseScale, -baseScale, baseScale)
    sword.position.z -= 2

    const tl = gsap.timeline({ delay: 1.2 })

    tl.to(sword.scale, {
      x: -baseScale,
      y: -baseScale,
      z: baseScale,
      duration: .5,
      ease: "easeIncubic"
    }, 0)

    tl.to(sword.rotation, {
      x: Math.PI / 7,
      z: Math.PI / 7,
      y: Math.PI / 9,
      duration: .5,
      ease: "easeIncubic"
    }, 0)

    tl.to(sword.position, {
      x: "-=2.2",
      z: "+=9",
      y: "-=1.3",
      duration: .5,
      ease: "easeIncubic"
    }, 0)

    tl.to(shaderContext.uBlackout, {
      value: 1.0,
      duration: .5,
      ease: "power3.inOut"
    }, 0)

    const katanaMesh = sword.getObjectByName('KATANA')
    const sheathMesh = sword.getObjectByName('sheath')

    if (katanaMesh) {
      const initialX = katanaMesh.position.x
      const moveDistance = size.length() * -5.5

      tl.to(katanaMesh.position, {
        x: initialX + moveDistance,
        duration: 1.5,
        ease: "power2.out"
      }, 0)
    }

    if (sheathMesh) {
      // no GUI, no change needed
    }
  })

  window.addEventListener("resize", onResize)
}

function animate() {
  requestAnimationFrame(animate)

  shaderContext.uTime.value = performance.now() * 0.001

  renderer.render(scene, camera)
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}