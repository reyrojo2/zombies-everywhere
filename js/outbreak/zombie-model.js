import * as THREE from 'three/webgpu';

// Eight shared instanced parts, independent of horde size. No new downloaded assets.
export class ZombieModels {
  constructor(scene, capacity) {
    this.group = new THREE.Group(); scene.add(this.group);
    const skin = new THREE.MeshStandardMaterial({ color: 0x829378, roughness: 1 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x343c36, roughness: 1 });
    const blood = new THREE.MeshStandardMaterial({ color: 0x632c25, roughness: 1 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x171b19, roughness: 1 });
    this.parts = [
      [cloth, [.43,.60,.25], [0,1.12,.08]], [skin,[.24,.28,.23],[0,1.60,.22]],
      [skin,[.11,.59,.12],[-.27,1.12,.31]], [skin,[.11,.54,.12],[.27,1.15,.34]],
      [dark,[.16,.76,.17],[-.12,.44,0]], [dark,[.16,.76,.17],[.12,.44,0]],
      [blood,[.20,.27,.02],[.08,1.12,.23]], [dark,[.20,.045,.025],[0,1.64,.345]]
    ].map(([material,size,offset]) => {
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(...size), material, capacity);
      mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; this.group.add(mesh);
      return {mesh, offset};
    });
    this.root = new THREE.Object3D(); this.part = new THREE.Object3D(); this.matrix = new THREE.Matrix4();
  }
  draw(actors, ground, time) {
    let count = 0;
    for (const a of actors) {
      if (a.state !== 'zombie' && a.state !== 'turning') continue;
      this.root.position.set(a.x,ground(null,a.x,a.z),a.z); this.root.rotation.set(0,a.heading,0); this.root.updateMatrix();
      const sway = Math.sin(time * 3 + a.id * 2);
      this.parts.forEach(({mesh,offset},i) => {
        this.part.position.set(...offset); this.part.rotation.set(0,0,0);
        if (i===0) this.part.rotation.x=.22;
        if (i===1) this.part.rotation.z=.14+sway*.05;
        if (i===2 || i===3) this.part.rotation.x=-.6-sway*.08;
        if (i===4 || i===5) this.part.rotation.x=sway*(i===4?.15:-.15);
        if (a.state==='turning') { this.part.position.y*=.45; this.part.position.z+=.25; }
        this.part.updateMatrix(); this.matrix.multiplyMatrices(this.root.matrix,this.part.matrix); mesh.setMatrixAt(count,this.matrix);
      }); count++;
    }
    for (const {mesh} of this.parts) { mesh.count=count; mesh.instanceMatrix.needsUpdate=true; }
  }
  reset() { for (const {mesh} of this.parts) mesh.count=0; }
}
