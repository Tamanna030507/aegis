import React, { useState, useEffect, useMemo, useCallback } from 'react';

/* =========================================================
   STABLE DEFAULT TEST DATA
========================================================= */
const defaultTestData = {
  faceScore: 7.2,
  breathRate: 24,
  tremorScore: 4.8,
  vocalScore: 6.1,
  vocalJitter: 1.45,
};

/* =========================================================
   MOCK API LAYER
========================================================= */
const mockApi = {
  getRisk: (id, testData) => {
    const hasFacePain = testData?.faceScore >= 6;
    const hasAbnormalBreath =
      testData?.breathRate > 22 || testData?.breathRate < 10;
    const hasTremor = testData?.tremorScore >= 5;
    const hasVocalStress = testData?.vocalScore >= 5;

    const triggers = [
      hasFacePain,
      hasAbnormalBreath,
      hasTremor,
      hasVocalStress,
    ].filter(Boolean).length;

    let level = 'low';
    let multiplier = 0.22;

    if (triggers >= 3) {
      level = 'critical';
      multiplier = 0.88;
    } else if (triggers >= 1) {
      level = 'high';
      multiplier = 0.64;
    }

    return Promise.resolve({
      risk_level: level,
      overall_risk: Number((multiplier + 0.04).toFixed(2)),
      day_post_op: 4,
      wound_component: testData?.faceScore
        ? parseFloat((1 - testData.faceScore / 10).toFixed(2))
        : 0.82,
    });
  },

  generatePassport: (id, testData) =>
    Promise.resolve({
      qr_image_base64:
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',

      passport_hash:
        '3045022100e4a7b5d2780e92f1b4a905a7698cf982efb01de20a8dcd12f5a892b1a6c4c0a1022026857d91e0a293a11b8b8efc0f2095f9d146cfd0233630f9a562df882ffde1c3',

      payload: {
        blood_type: 'O-Negative',
        implants: 'Titanium Left Hip Mesh',
        drug_contraindications: 'Warfarin, High-Dose Aspirin',
        emergency_contact: '+1-555-0199',

        telemetry: {
          face_pain_index:
            testData?.faceScore != null
              ? `${testData.faceScore}/10`
              : 'NOT_RECORDED',

          respiratory_rate:
            testData?.breathRate != null
              ? `${testData.breathRate} br/min`
              : 'NOT_RECORDED',

          motor_tremor_index:
            testData?.tremorScore != null
              ? `${testData.tremorScore}/10`
              : 'NOT_RECORDED',

          vocal_jitter:
            testData?.vocalJitter != null
              ? `${testData.vocalJitter}%`
              : 'NOT_RECORDED',
        },
      },

      expires_at: 'June 02, 2026',
    }),
};

/* =========================================================
   COMPONENT
========================================================= */
export default function Passport({
  patientId = '984-PX',
  testData = defaultTestData,
}) {
  const [riskData, setRiskData] = useState(null);
  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const [isSignatureValid, setIsSignatureValid] = useState(true);
  const [isTampered, setIsTampered] = useState(false);
  const [activeTab, setActiveTab] = useState('qr_view');

  /* =========================================================
     MEMOIZED QR BLOCKS
  ========================================================= */
  const qrBlocks = useMemo(() => {
    return Array.from({ length: 64 });
  }, []);

  /* =========================================================
     RISK FETCH
  ========================================================= */
  useEffect(() => {
    let mounted = true;

    setLoading(true);

    mockApi
      .getRisk(patientId, testData)
      .then((r) => {
        if (!mounted) return;

        setRiskData(r);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;

        setError('Could not load dynamic risk matrices.');
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [
    patientId,
    testData.faceScore,
    testData.breathRate,
    testData.tremorScore,
    testData.vocalScore,
    testData.vocalJitter,
  ]);

  /* =========================================================
     PASSPORT GENERATOR
  ========================================================= */
  const generatePassport = useCallback(async () => {
    if (generating) return;

    setGenerating(true);
    setError(null);

    try {
      const data = await mockApi.generatePassport(patientId, testData);

      setPassport(data);
      setIsSignatureValid(true);
      setIsTampered(false);
    } catch (e) {
      setError('Could not generate secure ledger passport.');
    } finally {
      setGenerating(false);
    }
  }, [patientId, testData, generating]);

  /* =========================================================
     TAMPER SIM
  ========================================================= */
  const triggerTamperSimulation = useCallback(() => {
    if (!passport) return;

    setIsTampered(true);
    setIsSignatureValid(false);
  }, [passport]);

  /* =========================================================
     RISK COLOR
  ========================================================= */
  const riskColor = (level) => {
    if (!level) return 'rgba(255,255,255,0.4)';
    if (level === 'critical') return '#ff4d6d';
    if (level === 'high') return '#ffb703';

    return '#00e5c3';
  };

  /* =========================================================
     MEMOIZED RISK ENTRIES
  ========================================================= */
  const riskEntries = useMemo(
    () => [
      {
        label: 'Patient Unique Core Identifier',
        value: patientId,
      },

      {
        label: 'Triage Dynamic Risk Designation',
        value:
          riskData?.risk_level?.toUpperCase() || 'NOT SYNCHRONIZED',
        color: riskColor(riskData?.risk_level),
      },

      {
        label: 'Calculated Compound Risk Gradient',
        value:
          riskData?.overall_risk != null
            ? `${(riskData.overall_risk * 100).toFixed(0)}% Mean Risk`
            : '—',
      },

      {
        label: 'Longitudinal Post-Operative Window',
        value: riskData?.day_post_op
          ? `Day ${riskData.day_post_op} Tracking Curve`
          : '—',
      },

      {
        label: 'Computer Vision Wound Tissue Score',
        value:
          riskData?.wound_component != null
            ? `${(riskData.wound_component * 100).toFixed(
                0
              )} / 100 Structural Score`
            : '—',
      },

      {
        label: 'Connected Facial Furrow Tense Delta',
        value:
          testData?.faceScore != null
            ? `${testData.faceScore} / 10`
            : 'No Stream',
      },

      {
        label: 'Connected Respiratory Target Vector',
        value:
          testData?.breathRate != null
            ? `${testData.breathRate} BPM`
            : 'No Stream',
      },

      {
        label: 'Connected Hand Stability Variance',
        value:
          testData?.tremorScore != null
            ? `${testData.tremorScore} Residual`
            : 'No Stream',
      },
    ],
    [patientId, riskData, testData]
  );

  /* =========================================================
     LOADING
  ========================================================= */
  if (loading) {
    return (
      <div
        style={{
          background: '#0a0e17',
          color: '#f3f4f6',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            color: '#00e5c3',
            fontSize: '2rem',
            fontFamily: 'monospace',
          }}
        >
          [SYNCING_LEDGER]
        </div>

        <p
          style={{
            color: '#9ca3af',
            marginTop: 12,
            fontSize: '0.85rem',
          }}
        >
          Compiling Cryptographic Patient Passport...
        </p>
      </div>
    );
  }

  /* =========================================================
     MAIN UI
  ========================================================= */
  return (
    <div
      style={{
        background: '#04080f',
        color: '#e8f4ff',
        padding: '16px',
        borderRadius: '16px',
        border: '1px solid rgba(0,229,195,0.12)',
        maxWidth: '480px',
        width: '100%',
        overflow: 'hidden',
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* HEADER */}
      <div
        style={{
          marginBottom: 20,
          paddingBottom: '10px',
          borderBottom: '1px solid rgba(0,229,195,0.15)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '4px',
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#00e5c3',
              boxShadow: '0 0 8px #00e5c3',
            }}
          />

          <span
            style={{
              fontSize: '0.65rem',
              color: '#00e5c3',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontWeight: 700,
              fontFamily: 'monospace',
            }}
          >
            SECURE ACCESS VECTOR
          </span>
        </div>

        <h1
          style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            margin: '2px 0 0 0',
            color: '#fff',
          }}
        >
          Surgical Passport
        </h1>

        <p
          style={{
            color: '#7aa4c4',
            fontSize: '0.72rem',
            margin: '4px 0 0 0',
            lineHeight: '1.4',
          }}
        >
          Cryptographically signed with ECDSA SECP256K1.
          Interconnects dynamic biometric streams completely
          offline.
        </p>
      </div>

      {/* TAB SWITCHER */}
      {passport && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
            marginBottom: '14px',
          }}
        >
          <button
            onClick={() => setActiveTab('qr_view')}
            style={{
              background:
                activeTab === 'qr_view'
                  ? '#0d1626'
                  : '#080e1a',

              color:
                activeTab === 'qr_view'
                  ? '#00e5c3'
                  : '#7aa4c4',

              border:
                activeTab === 'qr_view'
                  ? '1px solid rgba(0,229,195,0.3)'
                  : '1px solid rgba(255,255,255,0.05)',

              padding: '8px 4px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              willChange: 'transform',
            }}
          >
            Passport QR Ledger
          </button>

          <button
            onClick={() => setActiveTab('payload_view')}
            style={{
              background:
                activeTab === 'payload_view'
                  ? '#0d1626'
                  : '#080e1a',

              color:
                activeTab === 'payload_view'
                  ? '#00e5c3'
                  : '#7aa4c4',

              border:
                activeTab === 'payload_view'
                  ? '1px solid rgba(0,229,195,0.3)'
                  : '1px solid rgba(255,255,255,0.05)',

              padding: '8px 4px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              willChange: 'transform',
            }}
          >
            Encrypted Payload Matrix
          </button>
        </div>
      )}

      {/* QR VIEW */}
      <div
        style={{
          display: activeTab === 'qr_view' ? 'block' : 'none',
        }}
      >
        <div
          style={{
            background: '#080e1a',
            border: '1px solid rgba(0,229,195,0.1)',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center',
            marginBottom: '16px',
          }}
        >
          {passport?.qr_image_base64 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '180px',
                  height: '180px',
                  background: '#fff',
                  padding: '10px',
                  borderRadius: '8px',
                  margin: '0 auto 14px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                }}
              >
                {qrBlocks.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: '18px',
                      height: '18px',
                      background:
                        (i * 7 + (isTampered ? 3 : 0)) % 2 === 0
                          ? '#000'
                          : 'transparent',
                    }}
                  />
                ))}

                {isTampered && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(255,77,109,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ff4d6d',
                      fontSize: '0.8rem',
                      fontWeight: 900,
                      backdropFilter: 'blur(2px)',
                      borderRadius: '8px',
                    }}
                  >
                    INTEGRITY COMPROMISED
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '20px',
                    background: isSignatureValid
                      ? 'rgba(0,229,195,0.1)'
                      : 'rgba(255,77,109,0.1)',

                    color: isSignatureValid
                      ? '#00e5c3'
                      : '#ff4d6d',

                    border: `1px solid ${
                      isSignatureValid
                        ? '#00e5c3'
                        : '#ff4d6d'
                    }`,
                  }}
                >
                  {isSignatureValid
                    ? 'VALID ECDSA VERIFIED'
                    : 'SIGNATURE BLOCK REJECTED'}
                </span>

                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '20px',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#7aa4c4',
                  }}
                >
                  Expires: {passport.expires_at}
                </span>
              </div>

              <p
                style={{
                  fontSize: '0.62rem',
                  color: '#3d6080',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  margin: '0 0 14px 0',
                  background: '#04080f',
                  padding: '8px',
                  borderRadius: '6px',
                  width: '100%',
                  boxSizing: 'border-box',
                  border:
                    '1px solid rgba(255,255,255,0.03)',
                }}
              >
                HASH:{' '}
                {isTampered ? 'MALFORMED_BITSTREAM_' : ''}
                {passport.passport_hash}
              </p>

              {isSignatureValid && (
                <button
                  onClick={triggerTamperSimulation}
                  style={{
                    background: 'transparent',
                    color: '#ffb300',
                    border: '1px dashed #ffb300',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.2s ease',
                    willChange: 'transform',
                  }}
                >
                  Simulate Packet Bit-Tampering
                </button>
              )}
            </div>
          ) : (
            <div style={{ padding: '20px 0' }}>
              <div
                style={{
                  width: '140px',
                  height: '140px',
                  margin: '0 auto 16px',
                  background: '#0d1626',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border:
                    '2px dashed rgba(0,229,195,0.2)',
                }}
              >
                <div
                  style={{
                    color: '#3d6080',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                  }}
                >
                  NO ACTIVE PASS
                </div>
              </div>

              <button
                onClick={
                  !generating ? generatePassport : undefined
                }
                disabled={generating}
                style={{
                  width: '100%',
                  background:
                    'linear-gradient(135deg,#00c9a8,#00e5c3)',
                  color: '#040d18',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '6px',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  boxShadow:
                    '0 4px 12px rgba(0,229,195,0.2)',
                  transition: 'all 0.2s ease',
                  willChange: 'transform',
                }}
              >
                {generating
                  ? 'Compiling Signature Matrix...'
                  : 'Generate Validated Surgical Passport'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PAYLOAD VIEW */}
      <div
        style={{
          display:
            activeTab === 'payload_view'
              ? 'block'
              : 'none',
        }}
      >
        {passport && (
          <div
            style={{
              background: '#080e1a',
              border: '1px solid rgba(0,229,195,0.1)',
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '10px',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: '#fff',
                }}
              >
                Asynchronous Offline Extraction Registry
              </span>

              <span
                style={{
                  fontSize: '0.6rem',
                  background: 'rgba(0,229,195,0.15)',
                  color: '#00e5c3',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                }}
              >
                IMMUTABLE BLOB
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {[
                {
                  title:
                    'Emergency Blood Substrate Type',
                  val: passport?.payload?.blood_type,
                },

                {
                  title:
                    'Documented Hardware / Structural Implants',
                  val: passport?.payload?.implants,
                },

                {
                  title:
                    'Critical Drug Cross-Interferences',
                  val:
                    passport?.payload
                      ?.drug_contraindications,
                },

                {
                  title:
                    'Institutional Trauma Secondary Contact',
                  val:
                    passport?.payload
                      ?.emergency_contact,
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#0d1626',
                    padding: '8px',
                    borderRadius: '6px',
                    border:
                      '1px solid rgba(255,255,255,0.02)',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      fontSize: '0.58rem',
                      color: '#7aa4c4',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {item.title}
                  </span>

                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: isTampered
                        ? '#ff4d6d'
                        : '#fff',

                      fontWeight: 600,
                      fontFamily: 'monospace',
                    }}
                  >
                    {isTampered
                      ? 'CORRUPTED_BLOB_EXCEPTION'
                      : item.val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RISK MATRIX */}
      <div
        style={{
          background: '#080e1a',
          border: '1px solid rgba(0,229,195,0.1)',
          borderRadius: '12px',
          padding: '12px 14px',
        }}
      >
        <p
          style={{
            margin: '0 0 10px 0',
            fontSize: '0.72rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            color: '#7aa4c4',
            letterSpacing: '0.5px',
            fontFamily: 'monospace',
          }}
        >
          Telemetric Risk Index Parity
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {riskEntries.map(
            ({ label, value, color }, idx, arr) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom:
                    idx === arr.length - 1
                      ? 'none'
                      : '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#7aa4c4',
                  }}
                >
                  {label}
                </span>

                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: color || '#fff',
                    fontFamily: 'monospace',
                  }}
                >
                  {value}
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div
          style={{
            marginTop: '12px',
            background: 'rgba(255,77,109,0.05)',
            border: '1px solid #ff4d6d',
            padding: '10px',
            borderRadius: '8px',
            fontSize: '0.75rem',
          }}
        >
          <span
            style={{
              color: '#ff4d6d',
              fontWeight: 900,
              display: 'block',
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              marginBottom: '2px',
            }}
          >
            Network Pipe Disconnection
          </span>

          <p
            style={{
              margin: 0,
              color: '#e5e7eb',
            }}
          >
            {error}
          </p>
        </div>
      )}

      {/* FOOTER */}
      <div
        style={{
          marginTop: '14px',
          textAlign: 'center',
          background: 'rgba(0,229,195,0.02)',
          padding: '8px',
          borderRadius: '8px',
          border: '1px solid rgba(0,229,195,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: isSignatureValid
              ? '#00e5c3'
              : '#ff4d6d',
            flexShrink: 0,
          }}
        />

        <span
          style={{
            fontSize: '0.62rem',
            color: '#3d6080',
            lineHeight: '1.3',
            textAlign: 'left',
          }}
        >
          Zero-Knowledge Execution: Emergency metrics
          match cryptographic bounds without forwarding
          external raw payload arrays over unsecured
          routing layers.
        </span>
      </div>
    </div>
  );
}