// src/utils/ai-verification.js
const axios = require('axios');

/**
 * Verify incident report using HuggingFace API (robust, supported model)
 * We use a sentiment model as a proxy to estimate whether a report
 * is likely to describe a negative/real incident. This is heuristic.
 */
// choose a default sentiment model; some older models are deprecated so we
// will attempt a small list of fallbacks rather than bouncing back‑and‑forth.
// Users can override by setting HUGGINGFACE_MODEL in .env.
let HF_MODEL = process.env.HUGGINGFACE_MODEL || 'distilbert-base-uncased-finetuned-sst-2-english';

// ordered fallbacks to try if a model returns 410
const HF_MODEL_FALLBACKS = [
  'distilbert-base-uncased-finetuned-sst-2-english',
  'cardiffnlp/twitter-roberta-base-sentiment',
  'nlptown/bert-base-multilingual-uncased-sentiment',
];

// track whether we have already logged a full-service outage warning this
// process restart; avoids flooding the console when every report fails
let hfOutageLogged = false;

/**
 * Local fallback confidence scorer using keyword analysis
 * Used when HuggingFace API is unavailable
 */
const calculateLocalConfidence = (description) => {
  if (!description || description.trim().length === 0) {
    return 0.2;
  }

  const lowerDesc = description.toLowerCase();
  
  // Crime indicators keywords
  const crimeKeywords = ['robbery', 'theft', 'assault', 'attack', 'murder', 'shooting', 'stabbing', 'robbery', 'broken', 'stolen', 'kidnapping', 'rape', 'vandalism', 'mugging'];
  const safetyKeywords = ['dangerous', 'unsafe', 'suspicious', 'threat', 'criminal', 'violence', 'armed', 'gang', 'fight', 'injury', 'injured'];
  
  // Count keyword matches
  let crimeMatches = 0;
  crimeKeywords.forEach(keyword => {
    if (lowerDesc.includes(keyword)) crimeMatches++;
  });
  
  let safetyMatches = 0;
  safetyKeywords.forEach(keyword => {
    if (lowerDesc.includes(keyword)) safetyMatches++;
  });

  // Calculate base confidence from keywords (0.3 - 0.8)
  const keywordConfidence = Math.min(0.8, 0.3 + (crimeMatches + safetyMatches) * 0.1);
  
  // Boost if description is detailed (length > 20 chars)
  const lengthBonus = description.trim().length > 20 ? 0.15 : 0;
  
  const finalConfidence = Math.min(1.0, keywordConfidence + lengthBonus);
  
  console.log(`📊 Local confidence calculation: keywords=${crimeMatches + safetyMatches}, length_bonus=${lengthBonus}, confidence=${finalConfidence}`);
  
  return parseFloat(finalConfidence.toFixed(2));
};


const verifyIncidentReport = async (description) => {
  // allow disabling AI altogether for offline or failing scenarios
  if (process.env.AI_VERIFICATION_ENABLED === 'false') {
    console.info('AI verification disabled via environment; marking as verified.');
    return { verified: true, confidence: 0.5 };
  }

  // attempt inference with each model in the fallback list exactly once
  for (const model of HF_MODEL_FALLBACKS) {
    try {
      HF_MODEL = model; // update current model for logging
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${HF_MODEL}`,
        { inputs: description },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          },
          timeout: 15000,
        }
      );

      // normalize response
      const data = response.data;
      let scores = [];
      if (Array.isArray(data)) {
        scores = data;
      } else if (data && data.label && data.score) {
        scores = [data];
      } else if (data && Array.isArray(data[0])) {
        scores = data[0];
      }

      if (!scores || scores.length === 0) {
        console.warn('HuggingFace: unexpected response shape, using local fallback');
        const localConfidence = calculateLocalConfidence(description);
        return { verified: localConfidence > 0.5, confidence: localConfidence };
      }

      const negativeCandidate = scores.find((s) => /negativ/i.test(s.label)) || null;
      const negativeScore = negativeCandidate ? negativeCandidate.score : 0;
      const verified = negativeScore > 0.6;
      const confidence = Math.max(...scores.map((s) => s.score || 0));

      console.log(`✅ Successfully verified incident with model ${model}. Confidence: ${confidence}, Verified: ${verified}`);
      return { verified, confidence: parseFloat((confidence || 0).toFixed(2)) };
    } catch (error) {
      // log only once per model failure to avoid repetition
      if (!hfOutageLogged || error.response?.status !== 410) {
        console.error('HuggingFace API error with model', model, error.message, 'Status:', error.response?.status);
      }
      if (error.response?.status === 410) {
        // if model is deprecated, try next model in loop
        console.warn(`⚠️ Model ${model} is deprecated (410), trying next model...`);
        continue; 
      }
      // for other errors just break and return with local fallback
      console.warn(`⚠️ HuggingFace error, using local fallback: ${error.message}`);
      break;
    }
  }

  if (!hfOutageLogged) {
    console.warn('⚠️ All HuggingFace models failed; using local keyword-based confidence calculator.');
    hfOutageLogged = true;
  }
  
  // Use local fallback when API fails
  const localConfidence = calculateLocalConfidence(description);
  return { verified: localConfidence > 0.5, confidence: localConfidence };
};

module.exports = { verifyIncidentReport };
