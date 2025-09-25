#!/usr/bin/env python3

import json

# Dictionary mapping answers to their specific hints (first 4 hints, keeping the 5th if it exists)
specific_hints = {
    "Quantum Mechanics": [
        "This branch of physics deals with the very small scale",
        "Describes behavior of atoms, electrons, and photons",
        "Foundation for understanding how particles behave differently than everyday objects",
        "Explains phenomena like superposition and wave functions"
    ],
    "Thermodynamics": [
        "This branch of physics focuses on heat and energy transfer",
        "Governs how engines, refrigerators, and power plants work",
        "Includes concepts like entropy and the laws of energy conservation",
        "Explains why perpetual motion machines are impossible"
    ],
    "Electromagnetic Radiation": [
        "This encompasses all forms of energy that travel through space as waves",
        "Can travel through vacuum at the speed of light",
        "Has both electric and magnetic field components oscillating perpendicular to each other",
        "Different wavelengths correspond to different types like gamma rays, X-rays, and microwaves"
    ],
    "Schrödinger's Cat": [
        "This famous thought experiment illustrates the bizarre nature of quantum mechanics",
        "Proposed by an Austrian physicist to criticize the Copenhagen interpretation",
        "Involves a hypothetical scenario with a sealed box and a radioactive atom",
        "Demonstrates the concept of superposition on a macroscopic scale"
    ],
    "Wave-Particle Duality": [
        "This fundamental concept explains how light and matter can behave in two different ways",
        "Demonstrated by experiments like the double-slit experiment with electrons",
        "Shows that photons can act like particles when detected but waves when traveling",
        "Led to the development of quantum mechanics in the early 20th century"
    ],
    "Conservation of Energy": [
        "This fundamental law states that the total energy in a closed system remains constant",
        "Energy can be transformed from one form to another but never lost",
        "First formulated in the 19th century during the development of thermodynamics",
        "Explains why perpetual motion machines cannot work"
    ],
    "Ohm's Law": [
        "This electrical law describes the relationship between voltage, current, and resistance",
        "Formulated by German physicist Georg Ohm in 1827",
        "States that current through a conductor is directly proportional to voltage",
        "Essential for designing electrical circuits and understanding electrical flow"
    ],
    "Nuclear Fusion": [
        "This process combines lighter atomic nuclei to form heavier ones",
        "Powers the sun and all other stars in the universe",
        "Releases enormous amounts of energy when hydrogen atoms fuse into helium",
        "Scientists are working to harness this process for clean energy on Earth"
    ],
    "Doppler Effect": [
        "This phenomenon occurs when a wave source moves relative to an observer",
        "Explains why ambulance sirens sound different approaching versus moving away",
        "Used by astronomers to determine if stars are moving toward or away from Earth",
        "Also applies to light waves, causing redshift and blueshift in space"
    ],
    "Superconductivity": [
        "This remarkable phenomenon occurs when electrical resistance drops to exactly zero",
        "Only happens at extremely low temperatures near absolute zero",
        "Allows electric current to flow through materials without any energy loss",
        "Used in MRI machines, particle accelerators, and quantum computers"
    ],
    "Relativity": [
        "This revolutionary theory changed our understanding of space and time",
        "Developed by Einstein in the early 20th century",
        "Comes in two forms: special relativity and general relativity",
        "Shows that time and space are interconnected and can be warped by gravity"
    ],
    "Newton's Laws": [
        "These three fundamental principles describe the relationship between forces and motion",
        "Formulated by Isaac Newton in the 17th century",
        "Include the laws of inertia, acceleration, and action-reaction",
        "Form the foundation of classical mechanics and engineering"
    ],
    "Momentum": [
        "This physical quantity describes an object's motion as mass times velocity",
        "Always conserved in closed systems with no external forces",
        "Helps explain why heavy moving objects are harder to stop than light ones",
        "Used to analyze collisions and predict outcomes in physics problems"
    ],
    "Angular Momentum": [
        "This rotational equivalent of linear momentum describes spinning motion",
        "Conserved when no external torques act on a system",
        "Explains why figure skaters spin faster when they pull in their arms",
        "Important in understanding planetary orbits and atomic structure"
    ],
    "Gravitational Waves": [
        "These ripples in spacetime were predicted by Einstein's general relativity",
        "Created when massive objects like black holes accelerate through space",
        "Travel at the speed of light and can stretch and compress space itself",
        "First directly detected by LIGO interferometers in 2015"
    ],
    "Black Holes": [
        "These cosmic objects have gravitational fields so strong that nothing can escape",
        "Form when massive stars collapse at the end of their lives",
        "Have an event horizon beyond which no information can return",
        "Warp spacetime so extremely that time dilates significantly near them"
    ],
    "Entropy": [
        "This thermodynamic quantity measures the disorder or randomness in a system",
        "Always increases in isolated systems according to the second law of thermodynamics",
        "Explains why heat flows from hot to cold and why perpetual motion is impossible",
        "Connected to information theory and the fundamental nature of time"
    ],
    "Pressure": [
        "This physical quantity measures force applied perpendicular to a surface area",
        "Increases with depth in fluids due to the weight of the fluid above",
        "Measured in units like pascals, pounds per square inch, or atmospheres",
        "Essential for understanding weather patterns, hydraulics, and gas behavior"
    ],
    "Density": [
        "This property measures how much mass is contained in a given volume",
        "Determines whether objects will float or sink in fluids",
        "Varies greatly between different materials like lead versus cork",
        "Used to identify materials and understand their physical properties"
    ],
    "Velocity": [
        "This vector quantity describes both the speed and direction of motion",
        "Different from speed because it includes directional information",
        "Can be constant even when an object changes direction at constant speed",
        "Essential for analyzing motion in multiple dimensions"
    ],
    "Acceleration": [
        "This vector quantity measures how quickly velocity changes over time",
        "Can occur when speeding up, slowing down, or changing direction",
        "Caused by the application of forces according to Newton's second law",
        "Measured in units of distance per time squared like meters per second squared"
    ],
    "Force": [
        "This vector quantity causes objects to accelerate or change their motion",
        "Measured in newtons in the metric system",
        "Can be contact forces like friction or non-contact forces like gravity",
        "Related to acceleration through Newton's second law: F = ma"
    ],
    "Energy": [
        "This fundamental quantity represents the capacity to do work or cause change",
        "Comes in many forms including kinetic, potential, thermal, and electromagnetic",
        "Always conserved in closed systems according to fundamental physical laws",
        "Can be converted from one form to another but never created or destroyed"
    ],
    "Power": [
        "This quantity measures how quickly energy is transferred or work is done",
        "Calculated as energy divided by time or work divided by time",
        "Measured in watts, which equals one joule per second",
        "Important for understanding electrical devices and mechanical systems"
    ],
    "Work": [
        "This quantity measures energy transfer when a force acts through a distance",
        "Calculated as force times distance when force is applied in the direction of motion",
        "Only occurs when there is both force and displacement in the same direction",
        "Measured in joules in the metric system"
    ],
    "Friction": [
        "This force opposes motion between surfaces that are in contact",
        "Can be static (preventing motion) or kinetic (opposing existing motion)",
        "Depends on the normal force and the roughness of the surfaces",
        "Essential for walking, driving, and many everyday activities"
    ],
    "Magnetism": [
        "This fundamental force arises from the motion of electric charges",
        "Creates fields that can attract or repel magnetic materials",
        "Closely related to electricity through electromagnetic theory",
        "Used in motors, generators, and magnetic storage devices"
    ],
    "Electric Field": [
        "This invisible field surrounds electrically charged objects",
        "Exerts forces on other charged particles within the field",
        "Measured in volts per meter or newtons per coulomb",
        "Fundamental to understanding how electrical forces work at a distance"
    ],
    "Magnetic Field": [
        "This invisible field surrounds magnets and moving electric charges",
        "Can be visualized using iron filings that align with field lines",
        "Measured in tesla or gauss units",
        "Essential for understanding motors, generators, and particle accelerators"
    ],
    "Inductance": [
        "This electrical property opposes changes in electric current",
        "Creates back-voltage when current through a coil changes",
        "Measured in henries and depends on coil geometry and core material",
        "Important in transformers, motors, and AC circuit analysis"
    ],
    "Capacitance": [
        "This electrical property measures the ability to store electric charge",
        "Determined by the geometry and materials of the capacitor",
        "Measured in farads and increases with larger plate area",
        "Used in electronic circuits for energy storage and signal filtering"
    ],
    "Resonance": [
        "This phenomenon occurs when a system vibrates at its natural frequency",
        "Results in maximum amplitude oscillations with minimal driving force",
        "Can be destructive in bridges or beneficial in musical instruments",
        "Occurs in mechanical, electrical, and acoustic systems"
    ],
    "Interference": [
        "This wave phenomenon occurs when two or more waves overlap",
        "Can result in constructive interference (amplification) or destructive interference (cancellation)",
        "Explains patterns seen in ripples on water or light through slits",
        "Fundamental to understanding wave behavior and many optical devices"
    ],
    "Diffraction": [
        "This wave phenomenon occurs when waves bend around obstacles or through openings",
        "More pronounced when the obstacle size is similar to the wavelength",
        "Explains why sound can be heard around corners but light generally cannot",
        "Used in optical gratings and X-ray crystallography"
    ],
    "Refraction": [
        "This phenomenon occurs when waves change direction as they pass between different media",
        "Caused by changes in wave speed in different materials",
        "Explains why objects appear bent when viewed through water",
        "Fundamental to how lenses, prisms, and fiber optics work"
    ],
    "Reflection": [
        "This phenomenon occurs when waves bounce off a surface",
        "Follows the law that the angle of incidence equals the angle of reflection",
        "Can be specular (mirror-like) or diffuse (scattered) depending on surface smoothness",
        "Essential for mirrors, radar, and many optical devices"
    ],
    "Polarization": [
        "This wave property describes the direction of oscillation in transverse waves",
        "Light waves can be polarized by special filters or reflection",
        "Explains how polarized sunglasses reduce glare from horizontal surfaces",
        "Used in LCD displays, optical communications, and stress analysis"
    ],
    "Photoelectric Effect": [
        "This phenomenon occurs when light ejects electrons from a material surface",
        "Einstein's explanation of this effect won him the Nobel Prize",
        "Demonstrates the particle nature of light through discrete photon interactions",
        "Forms the basis for photodiodes, solar cells, and image sensors"
    ],
    "Atomic Structure": [
        "This describes how atoms are organized with nuclei surrounded by electrons",
        "Consists of protons and neutrons in the nucleus with electrons in orbitals",
        "Determines the chemical properties and behavior of elements",
        "Understanding this structure led to the development of quantum mechanics"
    ],
    "Radioactivity": [
        "This phenomenon involves the spontaneous decay of unstable atomic nuclei",
        "Discovered by Henri Becquerel and studied extensively by the Curies",
        "Produces alpha particles, beta particles, or gamma rays",
        "Used in medical imaging, cancer treatment, and dating archaeological specimens"
    ],
    "Half-Life": [
        "This measure describes how long it takes for half of a radioactive sample to decay",
        "Varies greatly between different isotopes, from microseconds to billions of years",
        "Remains constant regardless of the amount of material present",
        "Used to date ancient artifacts and predict radioactive waste dangers"
    ],
    "Nuclear Fission": [
        "This process splits heavy atomic nuclei into smaller fragments",
        "Releases enormous amounts of energy along with neutrons and radiation",
        "Powers nuclear reactors and was used in the first atomic bombs",
        "Can be controlled in reactors or uncontrolled in weapons"
    ],
    "Beta Decay": [
        "This radioactive process involves the emission of beta particles from atomic nuclei",
        "Converts neutrons to protons (or vice versa) through weak nuclear force",
        "Beta particles are actually high-energy electrons or positrons",
        "Important in nuclear physics and medical radioisotope production"
    ],
    "Alpha Particles": [
        "These are helium nuclei consisting of two protons and two neutrons",
        "Emitted during the radioactive decay of heavy elements",
        "Have low penetrating power and can be stopped by paper or skin",
        "Used in smoke detectors and some medical treatments"
    ],
    "Gamma Rays": [
        "These are the highest-energy form of electromagnetic radiation",
        "Often emitted during radioactive decay along with alpha or beta particles",
        "Have no mass or charge but carry enormous amounts of energy",
        "Used in medical imaging, cancer treatment, and sterilization"
    ],
    "X-Rays": [
        "These high-energy electromagnetic waves can penetrate soft tissue but not bone",
        "Discovered by Wilhelm Röntgen in 1895, earning him the first Nobel Prize in Physics",
        "Produced when high-speed electrons strike a metal target",
        "Revolutionized medical diagnosis and are used in security screening"
    ],
    "Ultraviolet Light": [
        "This electromagnetic radiation has wavelengths shorter than visible light",
        "Can cause sunburn and skin damage but is also essential for vitamin D production",
        "Divided into UV-A, UV-B, and UV-C based on wavelength",
        "Used for sterilization, fluorescence studies, and astronomical observations"
    ],
    "Infrared Radiation": [
        "This electromagnetic radiation has wavelengths longer than visible light",
        "Commonly experienced as heat from warm objects",
        "Used in night vision equipment, remote controls, and thermal imaging",
        "All objects with temperature above absolute zero emit this type of radiation"
    ],
    "Microwave Radiation": [
        "This electromagnetic radiation has wavelengths between infrared and radio waves",
        "Used for cooking food by causing water molecules to vibrate",
        "Essential for satellite communications, radar, and cell phone networks",
        "Can penetrate some materials but is absorbed by water and other polar molecules"
    ],
    "Radio Waves": [
        "These are the longest wavelength form of electromagnetic radiation",
        "Used for broadcasting radio, television, and wireless communications",
        "Can travel great distances and penetrate through many materials",
        "Also emitted naturally by astronomical objects like pulsars and quasars"
    ],
    "Plasma": [
        "This is often called the fourth state of matter after solid, liquid, and gas",
        "Consists of ionized gas with free electrons and positive ions",
        "Exists naturally in stars, lightning, and the aurora borealis",
        "Used in plasma TVs, fusion reactors, and industrial cutting tools"
    ],
    "Bose-Einstein Condensate": [
        "This exotic state of matter occurs at temperatures near absolute zero",
        "Predicted by Einstein and Bose in the 1920s but not created until 1995",
        "All atoms in the condensate occupy the same quantum state",
        "Exhibits strange quantum properties on a macroscopic scale"
    ],
    "Laser": [
        "This device produces intense, focused beams of coherent light",
        "Stands for Light Amplification by Stimulated Emission of Radiation",
        "All photons have the same wavelength, phase, and direction",
        "Used in communications, surgery, manufacturing, and entertainment"
    ],
    "Holography": [
        "This technique creates three-dimensional images using interference patterns of light",
        "Records both the intensity and phase information of light waves",
        "Originally developed for improving electron microscope resolution",
        "Now used for art, security features, and data storage"
    ],
    "Fiber Optics": [
        "This technology transmits information using light pulses through glass fibers",
        "Based on total internal reflection to keep light trapped within the fiber",
        "Enables high-speed internet and long-distance communications",
        "Also used in medical endoscopes and decorative lighting"
    ],
    "Semiconductor": [
        "These materials have electrical conductivity between that of conductors and insulators",
        "Can be doped with impurities to control their electrical properties",
        "Form the basis for all modern electronic devices",
        "Include materials like silicon, germanium, and gallium arsenide"
    ],
    "Transistor": [
        "This semiconductor device can amplify signals or act as an electronic switch",
        "Invented in 1947 and revolutionized electronics by replacing vacuum tubes",
        "Forms the basic building block of all modern computer processors",
        "Billions of these devices can fit on a single microprocessor chip"
    ],
    "Diode": [
        "This semiconductor device allows current to flow in only one direction",
        "Acts like a one-way valve for electrical current",
        "Used in rectifiers to convert AC to DC power",
        "Light-emitting diodes (LEDs) produce light when current flows through them"
    ],
    "Integrated Circuit": [
        "This electronic component combines many transistors and other elements on a single chip",
        "Invented in 1958 and enabled the miniaturization of electronics",
        "Can contain billions of transistors in a space smaller than a fingernail",
        "Forms the heart of computers, smartphones, and countless other devices"
    ],
    "Supernova": [
        "This explosive stellar death occurs when massive stars run out of nuclear fuel",
        "Can briefly outshine an entire galaxy containing billions of stars",
        "Creates and disperses heavy elements essential for planet formation",
        "May leave behind neutron stars or black holes as remnants"
    ],
    "Neutron Star": [
        "This incredibly dense stellar remnant forms after a supernova explosion",
        "Contains the mass of the sun compressed into a sphere about 12 miles across",
        "Composed almost entirely of neutrons packed to nuclear density",
        "Rotates rapidly and can emit beams of radiation as pulsars"
    ],
    "White Dwarf": [
        "This stellar remnant forms when lower-mass stars exhaust their nuclear fuel",
        "About the size of Earth but with the mass of the sun",
        "Extremely hot initially but gradually cools over billions of years",
        "Represents the final fate of stars like our sun"
    ],
    "Red Giant": [
        "This phase occurs when stars exhaust hydrogen in their cores and expand dramatically",
        "Can become hundreds of times larger than their original size",
        "Our sun will become one of these in about 5 billion years",
        "Eventually shed their outer layers to form planetary nebulae"
    ],
    "Main Sequence": [
        "This stable phase represents most of a star's lifetime burning hydrogen in its core",
        "Stars spend 80-90% of their lives in this stage",
        "Our sun is currently in this phase and has been for about 4.6 billion years",
        "Position on this sequence depends on the star's mass and determines its properties"
    ],
    "Nuclear Binding Energy": [
        "This energy holds protons and neutrons together in atomic nuclei",
        "Must be overcome to break apart a nucleus into separate nucleons",
        "Explains why nuclear reactions release so much more energy than chemical reactions",
        "Peaks at iron, explaining why fusion and fission both can release energy"
    ],
    "Mass-Energy Equivalence": [
        "This principle states that mass and energy are interchangeable",
        "Expressed by Einstein's famous equation E = mc²",
        "Explains how nuclear reactions convert small amounts of mass into enormous energy",
        "Fundamental to understanding nuclear power, stellar fusion, and particle physics"
    ],
    "Antimatter": [
        "This consists of particles with properties opposite to ordinary matter",
        "When matter and antimatter meet, they annihilate producing pure energy",
        "Positrons are the antimatter counterparts of electrons",
        "Studied in particle accelerators and has potential applications in medical imaging"
    ],
    "Particle Accelerator": [
        "These machines accelerate charged particles to extremely high speeds",
        "Use electromagnetic fields to boost particles to near light speed",
        "Include linear accelerators, cyclotrons, and synchrotrons",
        "Essential for discovering new particles and understanding fundamental physics"
    ],
    "Higgs Boson": [
        "This fundamental particle gives other particles their mass",
        "Predicted by the Standard Model of particle physics in the 1960s",
        "Finally discovered at the Large Hadron Collider in 2012",
        "Its discovery completed our understanding of the Standard Model"
    ],
    "String Theory": [
        "This theoretical framework proposes that fundamental particles are one-dimensional strings",
        "Attempts to unify quantum mechanics with general relativity",
        "Suggests the existence of additional spatial dimensions beyond the familiar three",
        "Remains unproven experimentally but offers elegant mathematical solutions"
    ],
    "Dark Matter": [
        "This mysterious substance makes up about 27% of the universe",
        "Doesn't emit, absorb, or reflect light, making it invisible to telescopes",
        "Its presence is inferred from gravitational effects on visible matter",
        "Essential for explaining galaxy formation and large-scale structure of the universe"
    ],
    "Dark Energy": [
        "This mysterious force causes the expansion of the universe to accelerate",
        "Makes up about 68% of the total energy content of the universe",
        "Discovered through observations of distant supernovae in the 1990s",
        "Its nature remains one of the biggest unsolved problems in cosmology"
    ],
    "Big Bang Theory": [
        "This scientific model describes how the universe expanded from an initial hot, dense state",
        "Supported by evidence including cosmic microwave background radiation",
        "Explains the observed abundance of light elements in the universe",
        "Occurred approximately 13.8 billion years ago according to current measurements"
    ],
    "Cosmic Microwave Background": [
        "This radiation is the afterglow of the Big Bang, now cooled by universal expansion",
        "Discovered accidentally in 1965 by radio astronomers",
        "Provides a snapshot of the universe when it was only 380,000 years old",
        "Its tiny temperature fluctuations seeded the formation of galaxies and stars"
    ],
    "Redshift": [
        "This phenomenon occurs when light from distant objects is stretched to longer wavelengths",
        "Caused by the expansion of space itself carrying galaxies away from us",
        "Used to measure distances to far galaxies and study the universe's expansion",
        "Provides evidence for the Big Bang theory and cosmic inflation"
    ],
    "Hubble's Law": [
        "This relationship states that distant galaxies move away from us faster than nearby ones",
        "Discovered by Edwin Hubble in 1929 using observations of galaxy redshifts",
        "Provides evidence that the universe is expanding uniformly in all directions",
        "The Hubble constant describes the current rate of universal expansion"
    ],
    "Special Relativity": [
        "This theory describes the relationship between space and time for objects moving at high speeds",
        "Published by Einstein in 1905 and revolutionized physics",
        "Shows that time slows down and lengths contract at speeds approaching light",
        "Led to the famous equation E = mc² relating mass and energy"
    ],
    "General Relativity": [
        "This theory describes gravity as the curvature of spacetime caused by mass and energy",
        "Published by Einstein in 1915 as an extension of special relativity",
        "Explains phenomena like black holes, gravitational lensing, and GPS corrections",
        "Predicts the existence of gravitational waves, confirmed by LIGO in 2015"
    ],
    "Time Dilation": [
        "This relativistic effect causes time to pass more slowly in strong gravitational fields",
        "Also occurs when objects move at high speeds relative to an observer",
        "Must be accounted for in GPS satellites to maintain accurate positioning",
        "Means that astronauts age slightly slower than people on Earth"
    ],
    "Length Contraction": [
        "This relativistic effect causes objects to appear shorter when moving at high speeds",
        "Only occurs in the direction of motion, not perpendicular to it",
        "Becomes significant only at speeds approaching the speed of light",
        "Paired with time dilation as consequences of special relativity"
    ],
    "Twin Paradox": [
        "This thought experiment illustrates the effects of time dilation in special relativity",
        "One twin travels at high speed while the other remains on Earth",
        "The traveling twin ages more slowly and returns younger than the Earth twin",
        "Demonstrates that time is not absolute but depends on motion and gravity"
    ],
    "Wormhole": [
        "These hypothetical tunnels could connect distant regions of spacetime",
        "Predicted by general relativity but never observed in nature",
        "Would require exotic matter with negative energy to remain stable",
        "Popular in science fiction as a method for faster-than-light travel"
    ],
    "Event Horizon": [
        "This boundary around a black hole marks the point of no return",
        "Nothing that crosses this boundary can escape, not even light",
        "Located at the Schwarzschild radius for non-rotating black holes",
        "Time appears to slow down dramatically near this boundary to outside observers"
    ],
    "Hawking Radiation": [
        "This theoretical radiation is emitted by black holes due to quantum effects",
        "Predicted by Stephen Hawking in 1974 using quantum field theory",
        "Causes black holes to slowly evaporate over enormous time periods",
        "Smaller black holes emit this radiation at higher temperatures than larger ones"
    ],
    "Quantum Entanglement": [
        "This phenomenon occurs when particles become correlated in such a way that measuring one instantly affects the other",
        "Einstein called it 'spooky action at a distance' and was troubled by it",
        "Fundamental to quantum computing and quantum cryptography",
        "Demonstrates non-local correlations that seem to violate classical intuition"
    ],
    "Quantum Tunneling": [
        "This quantum effect allows particles to pass through energy barriers they classically couldn't overcome",
        "Essential for nuclear fusion in stars and the operation of tunnel diodes",
        "Explains how particles can appear on the other side of barriers without enough energy to go over them",
        "Used in scanning tunneling microscopes to image individual atoms"
    ],
    # Geography specific hints
    "Antarctica": [
        "This is the southernmost continent on Earth",
        "Contains about 90% of the world's ice and 70% of its fresh water",
        "Temperatures can reach as low as -89°C (-128°F)",
        "Home to penguins, seals, and research stations from many countries"
    ],
    "Equator": [
        "This imaginary line divides Earth into northern and southern hemispheres",
        "Located at 0 degrees latitude and receives direct sunlight year-round",
        "Day and night are approximately equal in length throughout the year",
        "Passes through 13 countries including Ecuador, Kenya, and Indonesia"
    ],
    "Prime Meridian": [
        "This imaginary line divides Earth into eastern and western hemispheres",
        "Located at 0 degrees longitude and passes through Greenwich, England",
        "Used as the reference point for measuring longitude around the world",
        "Established as the international standard in 1884"
    ],
    "Tropic of Cancer": [
        "This imaginary line marks the northernmost point where the sun appears directly overhead",
        "Located at approximately 23.5 degrees north latitude",
        "Passes through countries like Mexico, Egypt, India, and China",
        "Marks the boundary between the tropics and temperate zone in the north"
    ],
    "Tropic of Capricorn": [
        "This imaginary line marks the southernmost point where the sun appears directly overhead",
        "Located at approximately 23.5 degrees south latitude",
        "Passes through Australia, Chile, Brazil, and southern Africa",
        "Marks the boundary between the tropics and temperate zone in the south"
    ],
    "Arctic Circle": [
        "This imaginary line marks where the midnight sun and polar night phenomena occur",
        "Located at approximately 66.5 degrees north latitude",
        "During summer solstice, the sun doesn't set for at least one day",
        "During winter solstice, the sun doesn't rise for at least one day"
    ],
    "Continental Drift": [
        "This theory explains how continents move across Earth's surface over geological time",
        "Proposed by Alfred Wegener in 1912 but initially rejected",
        "Supported by matching fossils and rock formations across oceans",
        "Later evolved into the more comprehensive plate tectonics theory"
    ],
    "Hurricane": [
        "These powerful tropical cyclones form over warm ocean waters",
        "Characterized by strong rotating winds exceeding 74 mph (119 km/h)",
        "Can cause devastating storm surges, flooding, and wind damage",
        "Most common in the Atlantic and Eastern Pacific during late summer"
    ],
    "Tornado": [
        "These violently rotating columns of air extend from thunderstorms to the ground",
        "Most common in the central United States during spring and early summer",
        "Can produce winds exceeding 300 mph (480 km/h) in extreme cases",
        "Measured using the Enhanced Fujita Scale from EF0 to EF5"
    ],
    "Climate Change": [
        "This refers to long-term shifts in global temperature and weather patterns",
        "Primarily caused by increased greenhouse gas emissions from human activities",
        "Results in rising sea levels, changing precipitation, and extreme weather",
        "One of the most pressing environmental challenges of our time"
    ],
    "Global Warming": [
        "This refers to the long-term increase in Earth's average surface temperature",
        "Primarily caused by increased concentrations of greenhouse gases",
        "Has accelerated significantly since the Industrial Revolution",
        "Leads to melting ice caps, rising sea levels, and changing weather patterns"
    ],
    "Greenhouse Effect": [
        "This natural process traps heat in Earth's atmosphere",
        "Caused by gases that absorb and re-emit infrared radiation",
        "Essential for maintaining temperatures suitable for life",
        "Enhanced by human activities, leading to global warming"
    ],
    "Ozone Layer": [
        "This protective layer in the stratosphere absorbs harmful ultraviolet radiation",
        "Composed primarily of ozone (O3) molecules",
        "Depleted by chemicals like CFCs, creating holes especially over Antarctica",
        "Protected by international agreements like the Montreal Protocol"
    ],
    "Atmosphere": [
        "This layer of gases surrounds Earth and is essential for life",
        "Composed mainly of nitrogen (78%) and oxygen (21%)",
        "Divided into layers including troposphere, stratosphere, and others",
        "Provides air pressure, weather, and protection from space radiation"
    ],
    "Lithosphere": [
        "This rigid outer layer of Earth includes the crust and upper mantle",
        "Broken into tectonic plates that move over geological time",
        "Where all landforms, mountains, and geological activity occur",
        "Interacts with the atmosphere, hydrosphere, and biosphere"
    ],
    "Hydrosphere": [
        "This includes all water on Earth's surface, underground, and in the atmosphere",
        "Comprises oceans, lakes, rivers, groundwater, and ice",
        "Covers about 71% of Earth's surface",
        "Essential for all known forms of life and weather systems"
    ],
    "Biosphere": [
        "This zone contains all living organisms on Earth",
        "Extends from deep ocean trenches to high in the atmosphere",
        "Includes all ecosystems and interactions between living things",
        "Where evolution, biodiversity, and ecological processes occur"
    ],
    "Weathering": [
        "This process breaks down rocks and minerals at Earth's surface",
        "Can be physical (mechanical) or chemical in nature",
        "Caused by factors like water, ice, wind, and temperature changes",
        "The first step in the formation of sediments and soil"
    ],
    "Erosion": [
        "This process transports weathered material from one place to another",
        "Caused by agents like water, wind, ice, and gravity",
        "Shapes landforms by wearing away mountains and filling valleys",
        "Works together with weathering to modify Earth's surface"
    ],
    "Sediment": [
        "These are fragments of rock, minerals, and organic material",
        "Transported by wind, water, or ice and deposited in new locations",
        "Can range in size from clay particles to large boulders",
        "Eventually forms sedimentary rocks through compaction and cementation"
    ],
    "Rock Cycle": [
        "This continuous process transforms rocks from one type to another",
        "Involves igneous, sedimentary, and metamorphic rock formation",
        "Driven by plate tectonics, weathering, and heat from Earth's interior",
        "Shows how all rock types are interconnected through geological processes"
    ],
    "Igneous Rock": [
        "These rocks form when molten material cools and solidifies",
        "Can form underground (intrusive) or on the surface (extrusive)",
        "Include rocks like granite, basalt, and obsidian",
        "Make up most of Earth's crust and provide clues about volcanic activity"
    ],
    "Sedimentary Rock": [
        "These rocks form from compressed and cemented layers of sediment",
        "Often contain fossils and show Earth's environmental history",
        "Include rocks like sandstone, limestone, and shale",
        "Cover about 75% of Earth's land surface despite being only 5% of the crust"
    ],
    "Metamorphic Rock": [
        "These rocks form when existing rocks are changed by heat and pressure",
        "Original rocks are transformed without melting completely",
        "Include rocks like marble, quartzite, and slate",
        "Often found in mountain ranges where intense geological forces operate"
    ],
    "Mineral": [
        "These naturally occurring inorganic substances have specific crystal structures",
        "Building blocks of rocks and have definite chemical compositions",
        "Include common examples like quartz, feldspar, and calcite",
        "Essential for industries, technology, and biological processes"
    ],
    "Crystal": [
        "These solids have atoms arranged in repeating geometric patterns",
        "Form naturally through geological processes over long periods",
        "Include gems like diamonds, emeralds, and sapphires",
        "Have specific properties based on their internal atomic structure"
    ],
    "Fossil": [
        "These are preserved remains or traces of ancient organisms",
        "Found in sedimentary rocks and provide evidence of past life",
        "Help scientists understand evolution and Earth's history",
        "Include body fossils, trace fossils, and molecular fossils"
    ],
    "Glacier": [
        "These massive bodies of ice form from accumulated snow over many years",
        "Flow slowly under their own weight, carving landscapes",
        "Store about 69% of the world's fresh water",
        "Sensitive indicators of climate change and global temperature"
    ],
    "Iceberg": [
        "These large pieces of freshwater ice float in ocean water",
        "Break off from glaciers and ice shelves in polar regions",
        "Only about 10% is visible above water due to ice density",
        "Can be dangerous to ships, as shown by the Titanic disaster"
    ],
    "Tundra": [
        "This cold biome has permanently frozen subsoil called permafrost",
        "Characterized by treeless landscapes with low-growing vegetation",
        "Found in Arctic regions and high mountain tops",
        "Has short growing seasons and supports specialized wildlife"
    ],
    "Taiga": [
        "This biome consists of coniferous forests in cold climates",
        "Also known as boreal forest, it's the world's largest biome",
        "Dominated by evergreen trees like spruce, fir, and pine",
        "Found across northern Canada, Alaska, Russia, and Scandinavia"
    ],
    "Temperate Forest": [
        "This biome has moderate climate with distinct seasons",
        "Dominated by deciduous trees that lose their leaves in winter",
        "Found in eastern North America, Europe, and parts of Asia",
        "Supports diverse wildlife and has rich, fertile soils"
    ],
    "Tropical Rainforest": [
        "This biome has year-round warmth and high precipitation",
        "Contains the highest biodiversity of any terrestrial ecosystem",
        "Found near the equator in South America, Africa, and Southeast Asia",
        "Has multiple layers from forest floor to emergent canopy"
    ],
    "Grassland": [
        "This biome is dominated by grasses with few trees",
        "Found in regions too dry for forests but too wet for deserts",
        "Includes prairies, pampas, and savannas in different regions",
        "Important for agriculture and grazing livestock"
    ],
    "Desert": [
        "This biome receives very little precipitation throughout the year",
        "Can be hot like the Sahara or cold like the Gobi",
        "Plants and animals have special adaptations to conserve water",
        "Covers about one-third of Earth's land surface"
    ],
    "Wetland": [
        "These areas are covered by water for at least part of the year",
        "Include swamps, marshes, bogs, and coastal wetlands",
        "Act as natural water filters and flood control systems",
        "Support diverse wildlife and are among the most productive ecosystems"
    ],
    "Estuary": [
        "These areas where rivers meet the sea have brackish water",
        "Important nursery areas for many marine species",
        "Highly productive ecosystems due to nutrient mixing",
        "Include famous examples like the Chesapeake Bay and San Francisco Bay"
    ],
    "Coral Reef": [
        "These marine ecosystems are built by coral polyps in tropical waters",
        "Support about 25% of marine species despite covering less than 1% of oceans",
        "Threatened by climate change, pollution, and ocean acidification",
        "Include barrier reefs, fringing reefs, and atolls"
    ],
    "Ocean Current": [
        "These continuous movements of seawater are driven by wind and density differences",
        "Transport heat, nutrients, and marine life around the globe",
        "Include surface currents and deep-water currents",
        "Play a major role in global climate and weather patterns"
    ],
    "Gulf Stream": [
        "This warm ocean current flows from the Gulf of Mexico toward Europe",
        "Part of the North Atlantic circulation system",
        "Keeps northwestern Europe warmer than other regions at similar latitudes",
        "Important for marine ecosystems and global heat distribution"
    ],
    "El Niño": [
        "This climate pattern involves warming of Pacific Ocean waters near South America",
        "Occurs irregularly every 2-7 years and affects global weather",
        "Can cause droughts in some regions and floods in others",
        "Paired with La Niña in what's called the El Niño-Southern Oscillation"
    ],
    "La Niña": [
        "This climate pattern involves cooling of Pacific Ocean waters near South America",
        "Often occurs after El Niño events and has opposite effects",
        "Can intensify hurricane seasons and cause widespread droughts",
        "Part of the natural climate cycle affecting global weather patterns"
    ],
    "Monsoon": [
        "These seasonal wind patterns bring distinct wet and dry seasons",
        "Most famous in South Asia where they bring essential rainfall",
        "Caused by temperature differences between land and ocean",
        "Critical for agriculture and water supply in affected regions"
    ],
    "Trade Winds": [
        "These steady easterly winds blow toward the equator",
        "Created by the rotation of Earth and pressure differences",
        "Historically used by sailing ships to cross oceans",
        "Play a key role in tropical weather patterns and ocean currents"
    ],
    "Jet Stream": [
        "These fast-moving air currents flow at high altitudes",
        "Created by temperature differences between air masses",
        "Influence weather patterns and storm tracks",
        "Used by aircraft to reduce flight times when flying eastward"
    ],
    "Longitude": [
        "These imaginary lines run north-south and measure distance east-west",
        "Measured in degrees from 0° to 180° east or west of the Prime Meridian",
        "Each degree represents about 69 miles at the equator",
        "Essential for navigation and determining time zones"
    ],
    "Latitude": [
        "These imaginary lines run east-west and measure distance north-south",
        "Measured in degrees from 0° at the equator to 90° at the poles",
        "Each degree represents about 69 miles everywhere on Earth",
        "Determines climate zones and seasonal variations"
    ],
    "Meridian": [
        "These imaginary lines connect the north and south poles",
        "All meridians are the same length and meet at the poles",
        "The Prime Meridian at Greenwich is the reference for longitude",
        "Used to establish time zones around the world"
    ],
    "Parallel": [
        "These imaginary lines run parallel to the equator",
        "Include important lines like the Tropics and Arctic/Antarctic Circles",
        "Get shorter toward the poles, unlike meridians",
        "Used to measure latitude and define climate zones"
    ],
    "Time Zone": [
        "These regions observe the same standard time for legal and commercial purposes",
        "Based on Earth's rotation of 15 degrees per hour",
        "Often follow political boundaries rather than strict meridian lines",
        "Help coordinate activities across different regions of the world"
    ],
    "International Date Line": [
        "This imaginary line roughly follows the 180° meridian in the Pacific Ocean",
        "Where each calendar day begins as Earth rotates",
        "Crossing eastward subtracts a day; westward adds a day",
        "Zigzags to avoid dividing countries between different calendar days"
    ],
    "Map Projection": [
        "These mathematical methods represent Earth's curved surface on flat maps",
        "Always involve some distortion of shape, area, distance, or direction",
        "Include projections like Mercator, Robinson, and Peters",
        "Each type is useful for different purposes and applications"
    ],
    "Scale": [
        "This shows the relationship between distances on a map and actual distances",
        "Can be expressed as ratios, fractions, or graphic scales",
        "Large-scale maps show small areas in great detail",
        "Small-scale maps show large areas with less detail"
    ],
    "Legend": [
        "This explains the symbols, colors, and patterns used on a map",
        "Also called a key, it helps users interpret map information",
        "Essential for understanding what different features represent",
        "Allows maps to convey complex information in a compact format"
    ],
    "Compass Rose": [
        "This symbol on maps shows the cardinal and intermediate directions",
        "Helps users orient themselves and determine directions",
        "Points toward magnetic north or true north",
        "Essential navigation tool for understanding map orientation"
    ],
    "Topographic Map": [
        "These maps show elevation and landforms using contour lines",
        "Provide three-dimensional information on two-dimensional surfaces",
        "Essential for hiking, engineering, and land-use planning",
        "Include features like trails, roads, buildings, and water bodies"
    ],
    "Contour Lines": [
        "These lines connect points of equal elevation on topographic maps",
        "Closely spaced lines indicate steep slopes",
        "Widely spaced lines indicate gentle slopes",
        "Allow visualization of three-dimensional terrain on flat maps"
    ],
    "Elevation": [
        "This measures height above a reference point, usually sea level",
        "Affects climate, vegetation, and human settlement patterns",
        "Shown on topographic maps using contour lines and spot elevations",
        "Important for engineering, aviation, and outdoor activities"
    ],
    "Sea Level": [
        "This is the average level of the ocean's surface",
        "Used as the standard reference point for measuring elevation",
        "Varies slightly due to tides, weather, and gravitational effects",
        "Rising due to climate change and thermal expansion of seawater"
    ],
    "Continental Shelf": [
        "This underwater extension of continents has relatively shallow water",
        "Extends from shore to where the ocean floor drops steeply",
        "Rich in marine life and important for fishing and oil drilling",
        "Legally defined for territorial and resource rights"
    ],
    "Abyssal Plain": [
        "These flat areas of the deep ocean floor are covered by sediments",
        "Found at depths of 3,000 to 6,000 meters",
        "Among the flattest places on Earth's surface",
        "Formed by sediments settling from overlying waters"
    ],
    "Mid-Ocean Ridge": [
        "These underwater mountain chains mark where new ocean floor forms",
        "Created by volcanic activity as tectonic plates separate",
        "Form the longest mountain range system on Earth",
        "Include features like the Mid-Atlantic Ridge"
    ],
    "Trench": [
        "These are the deepest parts of the ocean floor",
        "Formed where oceanic plates subduct beneath other plates",
        "Can reach depths of over 11,000 meters",
        "Include the Mariana Trench, the deepest known point on Earth"
    ],
    "Island Arc": [
        "These curved chains of volcanic islands form above subduction zones",
        "Created by magma rising from the subducting oceanic plate",
        "Include examples like Japan, the Philippines, and the Aleutians",
        "Often associated with earthquakes and volcanic activity"
    ],
    "Archipelago": [
        "This is a group or chain of islands clustered together",
        "Can be formed by volcanic activity, coral reefs, or rising sea levels",
        "Include examples like the Philippines, Indonesia, and Hawaii",
        "Often have unique ecosystems due to their isolation"
    ],
    "Peninsula": [
        "This landform is surrounded by water on three sides",
        "Connected to a larger landmass by a narrow strip of land",
        "Include examples like Florida, Italy, and the Korean Peninsula",
        "Often have strategic importance for trade and defense"
    ],
    "Isthmus": [
        "This narrow strip of land connects two larger landmasses",
        "Separates two bodies of water while linking two land areas",
        "Include famous examples like Panama and Suez",
        "Often chosen as locations for canals due to their geography"
    ],
    "Strait": [
        "This narrow waterway connects two larger bodies of water",
        "Can be natural channels between continents or islands",
        "Important for navigation and maritime trade routes",
        "Include examples like Gibraltar, Bering, and Hormuz"
    ],
    "Bay": [
        "This body of water is partially enclosed by land",
        "Usually smaller and more enclosed than a gulf",
        "Provide sheltered harbors for ships and boats",
        "Include examples like the Bay of Bengal and Hudson Bay"
    ],
    "Gulf": [
        "This large body of water is partially enclosed by land",
        "Usually larger and deeper than a bay",
        "Important for shipping, fishing, and oil drilling",
        "Include examples like the Gulf of Mexico and Persian Gulf"
    ],
    "Cape": [
        "This pointed landform extends into a body of water",
        "Often formed by erosion-resistant rock or volcanic activity",
        "Important landmarks for navigation throughout history",
        "Include famous examples like Cape Horn and Cape of Good Hope"
    ],
    "Delta": [
        "This triangular landform appears where rivers empty into larger bodies of water",
        "Formed by sediment deposition as river flow slows",
        "Often very fertile and important for agriculture",
        "Include examples like the Nile Delta and Mississippi Delta"
    ],
    "Floodplain": [
        "This flat area adjacent to rivers is periodically flooded",
        "Built up by sediments deposited during flood events",
        "Very fertile and important for agriculture",
        "Natural flood control area that can be damaged by development"
    ],
    "Watershed": [
        "This area of land drains into a particular river or water body",
        "Also called a drainage basin or catchment area",
        "Separated from other watersheds by ridges or high ground",
        "Important for water resource management and environmental protection"
    ],
    "Drainage Basin": [
        "This area collects precipitation and channels it into a common outlet",
        "Includes all the land that contributes water to a particular stream",
        "Can range from small valleys to continental-scale systems",
        "Essential concept for understanding water resources and floods"
    ],
    "Tributary": [
        "This smaller stream or river flows into a larger river",
        "Contributes water and sediment to the main channel",
        "Can have their own tributaries, creating branched drainage networks",
        "Important for understanding river systems and water flow patterns"
    ],
    "Confluence": [
        "This is where two or more rivers or streams meet",
        "Often creates larger, more powerful waterways downstream",
        "Important locations for settlements throughout history",
        "Can create unique ecosystems where different water masses mix"
    ],
    "Rapids": [
        "These are sections of rivers where water flows fast over rocky beds",
        "Created by sudden changes in elevation or channel constriction",
        "Popular for whitewater recreation but dangerous for navigation",
        "Often indicate underlying geological structure and rock resistance"
    ]
}

def main():
    # Load the questions file
    with open('/Users/mariana/code/loadsmile/hintman-game/backend/src/data/questions.json', 'r') as f:
        questions = json.load(f)

    generic_pattern = 'Fundamental principle governing motion and forces'
    replaced_count = 0

    # Find and replace all questions with generic patterns
    for question in questions:
        if ('hints' in question and
            len(question['hints']) > 0 and
            question['hints'][0] == generic_pattern and
            question['answer'] in specific_hints):

            # Get the specific hints for this answer
            new_hints = specific_hints[question['answer']].copy()

            # Keep the 5th hint if it exists and is specific (not generic)
            if len(question['hints']) >= 5:
                fifth_hint = question['hints'][4]
                if fifth_hint not in [
                    "Fundamental principle governing motion and forces",
                    "Key concept in understanding natural phenomena",
                    "Used in engineering and scientific applications",
                    "Essential for modern physics and technology"
                ]:
                    new_hints.append(fifth_hint)

            # Replace the hints
            question['hints'] = new_hints
            replaced_count += 1
            print(f"Replaced hints for: {question['answer']}")

    # Save the updated file
    with open('/Users/mariana/code/loadsmile/hintman-game/backend/src/data/questions.json', 'w') as f:
        json.dump(questions, f, indent=2, ensure_ascii=False)

    print(f"\nReplaced generic hints for {replaced_count} questions.")

if __name__ == "__main__":
    main()