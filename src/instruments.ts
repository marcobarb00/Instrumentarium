// The instruments in the collection, in the order the site presents them.
export interface InstrumentInfo {
  id: string;
  name: string;
  plate: string;
  blurb: string;
  /** False until the instrument's page exists. */
  ready: boolean;
}

export const INSTRUMENTS: InstrumentInfo[] = [
  { id: 'quadrant', name: 'Quadrant', plate: 'I', ready: true,
    blurb: 'A quarter circle with a plumb line. Sight a star along its edge and the hanging cord marks the star’s altitude.' },
  { id: 'astrolabe', name: 'Astrolabe', plate: 'II', ready: true,
    blurb: 'The sky flattened onto brass. Take a star’s altitude with the alidade, then turn the rete to find the hour.' },
  { id: 'sextant', name: 'Sextant', plate: 'III', ready: true,
    blurb: 'Two mirrors bring a star down to the sea horizon. Read the arc and the micrometer drum.' },
  { id: 'armillary', name: 'Ptolemy’s armillary', plate: 'IV', ready: true,
    blurb: 'Rings set to the ecliptic from the moon or a known star. Sight a star and read its longitude and latitude.' },
  { id: 'cross-staff', name: 'Cross-staff', plate: 'V', ready: false,
    blurb: 'Slide the transom until its ends touch two stars, then read the angle between them from the staff.' },
];
