export interface HowToGuide {
  id: string;
  name: {
    en: string;
    ta: string;
    hi: string;
  };
  iconName: string;
  steps: {
    en: string[];
    ta: string[];
    hi: string[];
  };
}

export const HOW_TO_GUIDES: HowToGuide[] = [
  {
    id: 'thermometer',
    name: {
      en: 'Digital Thermometer',
      ta: 'டிஜிட்டல் வெப்பமானி (Digital Thermometer)',
      hi: 'डिजिटल थर्मामीटर (Digital Thermometer)'
    },
    iconName: 'thermometer',
    steps: {
      en: [
        '1. Turn on the thermometer by pressing the power button until it beeps or displays "Lo".',
        '2. Place the silver tip under your tongue toward the back pocket of your mouth, and close your lips gently.',
        '3. Hold still and breathe normally through your nose until you hear the beep (about 30-60 seconds).',
        '4. Remove and read the temperature on the digital screen. Note down the reading.'
      ],
      ta: [
        '1. பவர் பட்டனை அழுத்தி வெப்பமானியை ஆன் செய்யவும் ("Lo" அல்லது பீப் ஒலி கேட்கும் வரை).',
        '2. அதன் வெள்ளி முனையை உங்கள் நாக்கின் அடியில் வைத்து, உதடுகளை மென்மையாக மூடவும்.',
        '3. பீப் ஒலி கேட்கும் வரை (சுமார் 30-60 விநாடிகள்) வாயைத் திறக்காமல் மூக்கின் வழியாக சுவாசிக்கவும்.',
        '4. திரையில் தெரியும் வெப்பநிலைக் குறிப்பை பார்த்து குறித்துக் கொள்ளவும்.'
      ],
      hi: [
        '1. पावर बटन दबाकर थर्मामीटर चालू करें जब तक कि वह बीप न करे या "Lo" न दिखाए।',
        '2. चांदी जैसी नोक को अपनी जीभ के नीचे रखें और अपने होंठ धीरे से बंद रखें।',
        '3. बीप की आवाज आने तक (लगभग 30-60 सेकंड) मुंह बंद रखें और नाक से सांस लें।',
        '4. स्क्रीन पर तापमान पढ़ें और नोट कर लें।'
      ]
    }
  },
  {
    id: 'bp_monitor',
    name: {
      en: 'Blood Pressure Monitor',
      ta: 'ரத்த அழுத்த மானி (BP Monitor)',
      hi: 'रक्तचाप मॉनिटर (BP Monitor)'
    },
    iconName: 'activity',
    steps: {
      en: [
        '1. Sit quietly with feet flat on the floor and back supported for 5 minutes before measurement.',
        '2. Wrap the cuff snugly around your bare upper arm, about 1 inch above your elbow crease.',
        '3. Rest your arm on a table so the cuff is at heart level. Keep palm facing up.',
        '4. Press Start. Remain silent and still while the cuff inflates and deflates automatically.'
      ],
      ta: [
        '1. அளவிடுவதற்கு முன் 5 நிமிடங்கள் கால்களை தரையில் வைத்து, முதுகு சாய்ந்து அமைதியாக அமரவும்.',
        '2. பட்டையை (Cuff) முழங்கைக்கு 1 அங்குலம் மேலே வெறும் கையில் இறுக்கமாக சுற்றவும்.',
        '3. கையை மேஜை மீது வைத்து, பட்டை இதய மட்டத்தில் இருக்குமாறு பார்த்துக்கொள்ளவும்.',
        '4. ஸ்டார்ட் பட்டனை அழுத்தவும். அளவு முடியும் வரை பேசாமல் அசையாமல் இருக்கவும்.'
      ],
      hi: [
        '1. नापने से पहले 5 मिनट तक शांत बैठें, दोनों पैर जमीन पर सीधे रखें।',
        '2. कफ को अपनी कोहनी के जोड़ से 1 इंच ऊपर बांह पर आराम से लपेटें।',
        '3. अपनी बांह को मेज पर रखें ताकि कफ दिल के स्तर पर रहे।',
        '4. स्टार्ट बटन दबाएं। रीडिंग आने तक चुपचाप और स्थिर बैठें।'
      ]
    }
  },
  {
    id: 'inhaler',
    name: {
      en: 'Metered-Dose Inhaler',
      ta: 'இன்ஹேலர் (Inhaler)',
      hi: 'इनहेलर (Inhaler)'
    },
    iconName: 'wind',
    steps: {
      en: [
        '1. Remove the cap and shake the inhaler vigorously 4 to 5 times.',
        '2. Sit upright and breathe out fully away from the inhaler.',
        '3. Place the mouthpiece between your teeth and seal your lips tightly around it.',
        '4. Press the canister down once while taking a slow, deep breath in for 3-5 seconds.',
        '5. Hold your breath for 10 seconds, then breathe out gently.'
      ],
      ta: [
        '1. மூடியை அகற்றி, இன்ஹேலரை 4-5 முறை நன்றாக குலுக்கவும்.',
        '2. நேராக அமர்ந்து, இன்ஹேலருக்கு வெளியே முழுமையாக மூச்சை வெளியிடவும்.',
        '3. வாய் பகுதியை உதடுகளால் இறுக்கமாக பிடித்துக்கொள்ளவும்.',
        '4. மெதுவாகவும் ஆழமாகவும் மூச்சை உள்ளிழுக்கும் போதே இன்ஹேலரை ஒருமுறை அழுத்தவும்.',
        '5. 10 விநாடிகள் மூச்சை அடக்கி, பின்னர் மெதுவாக வெளியிடவும்.'
      ],
      hi: [
        '1. कैप हटाएं और इनहेलर को 4-5 बार अच्छी तरह हिलाएं।',
        '2. सीधे बैठें और इनहेलर से दूर पूरी सांस बाहर छोड़ें।',
        '3. माउथपीस को अपने दांतों के बीच रखें और होंठों से अच्छी तरह बंद करें।',
        '4. धीमी, गहरी सांस लेते हुए इनहेलर को एक बार दबाएं।',
        '5. 10 सेकंड के लिए सांस रोकें, फिर धीरे से बाहर छोड़ें।'
      ]
    }
  },
  {
    id: 'pulse_oximeter',
    name: {
      en: 'Pulse Oximeter',
      ta: 'பல்ஸ் ஆக்ஸிமீட்டர் (Pulse Oximeter)',
      hi: 'पल्स ऑक्सीमीटर (Pulse Oximeter)'
    },
    iconName: 'heart',
    steps: {
      en: [
        '1. Ensure your hand is warm and remove any nail polish or artificial nails.',
        '2. Rest your hand on a flat surface and insert your index or middle finger completely into the device.',
        '3. Press the power button and stay still for 15-30 seconds until the reading stabilizes.',
        '4. Record both SpO2 percentage and pulse rate (PR bpm).'
      ],
      ta: [
        '1. கைகள் வெதுவெதுப்பாக இருக்கிறதா எனப் பார்க்கவும்; நகப்பூச்சு இருந்தால் அகற்றவும்.',
        '2. கையை மேஜை மீது வைத்து, ஆள்காட்டி அல்லது நடுவிரலை கருவிக்குள் முழுமையாக நுழைக்கவும்.',
        '3. பட்டனை இயக்கி, திரையில் எண் நிலைபெறும் வரை 15-30 விநாடிகள் அசையாமல் இருக்கவும்.',
        '4. SpO2 சதவீதம் மற்றும் நாடித்துடிப்பு (Pulse bpm) இரண்டையும் குறித்துக் கொள்ளவும்.'
      ],
      hi: [
        '1. ध्यान दें कि हाथ गर्म हो और उंगली पर नेल पॉलिश न लगी हो।',
        '2. अपनी तर्जनी (index) या मध्यमा उंगली को पूरी तरह डिवाइस के अंदर डालें।',
        '3. पावर बटन दबाएं और संख्या स्थिर होने तक 15-30 सेकंड शांत रहें।',
        '4. SpO2 प्रतिशत और पल्स रेट (PR bpm) दोनों को नोट करें।'
      ]
    }
  }
];
