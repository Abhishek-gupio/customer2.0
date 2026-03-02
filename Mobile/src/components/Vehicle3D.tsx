import React, { Suspense, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useGLTF, Environment, ContactShadows } from '@react-three/drei/native';
import * as THREE from 'three';

// Simple Car placeholder using primitives if GLTF fails or as a fallback
function SimpleCar() {
    const meshRef = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.5;
        }
    });

    return (
        <group ref={meshRef}>
            {/* Car Body */}
            <mesh position={[0, 0.4, 0]}>
                <boxGeometry args={[2, 0.5, 1]} />
                <meshStandardMaterial color="#FFBF00" />
            </mesh>
            {/* Cabin */}
            <mesh position={[-0.2, 0.8, 0]}>
                <boxGeometry args={[1, 0.5, 0.8]} />
                <meshStandardMaterial color="#333" />
            </mesh>
            {/* Wheels */}
            <mesh position={[-0.7, 0.2, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 0.2, 16]} />
                <meshStandardMaterial color="#000" />
            </mesh>
            <mesh position={[0.7, 0.2, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 0.2, 16]} />
                <meshStandardMaterial color="#000" />
            </mesh>
            <mesh position={[-0.7, 0.2, -0.5]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 0.2, 16]} />
                <meshStandardMaterial color="#000" />
            </mesh>
            <mesh position={[0.7, 0.2, -0.5]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 0.2, 16]} />
                <meshStandardMaterial color="#000" />
            </mesh>
        </group>
    );
}

// Model component that rotates only on Y axis
function CarModel({ modelUrl }: { modelUrl?: string }) {
    const meshRef = useRef<THREE.Group>(null);

    // Custom rotation logic - only Y axis
    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.5;
        }
    });

    try {
        const { scene } = useGLTF(modelUrl || 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Ferrari.glb');
        return (
            <primitive
                ref={meshRef}
                object={scene}
                scale={15}
                position={[0, -1, 0]}
            />
        );
    } catch (e) {
        return <SimpleCar />;
    }
}

interface Vehicle3DProps {
    modelUrl?: string;
    style?: any;
}

export default function Vehicle3D({ modelUrl, style }: Vehicle3DProps) {
    return (
        <View style={[styles.container, style]}>
            <Canvas shadows camera={{ position: [5, 2, 5], fov: 35 }}>
                <color attach="background" args={['#111']} />

                {/* Product shot lighting */}
                <ambientLight intensity={0.5} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} castShadow />
                <pointLight position={[-10, 5, -10]} intensity={1} color="#FFBF00" />
                <directionalLight position={[0, 10, 0]} intensity={0.5} />

                <Suspense fallback={
                    <View style={styles.loader}>
                        <ActivityIndicator color="#FFBF00" size="large" />
                    </View>
                }>
                    <Environment preset="city" />
                    <CarModel modelUrl={modelUrl} />
                    <ContactShadows
                        position={[0, -1, 0]}
                        opacity={0.6}
                        scale={10}
                        blur={2}
                        far={1.5}
                    />
                </Suspense>
            </Canvas>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 200,
        width: '100%',
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#111',
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
