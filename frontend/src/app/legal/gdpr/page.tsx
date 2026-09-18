import React from "react";

export const metadata = {
    title: "GDPR Compliance - HireHeaven",
    description: "HireHeaven GDPR Compliance - How we comply with the General Data Protection Regulation.",
};

export default function GDPRPage() {
    const headingStyle: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: "var(--foreground)", marginTop: 32, marginBottom: 12 };
    const paraStyle: React.CSSProperties = { fontSize: 15, lineHeight: "26px", color: "var(--muted-foreground)", marginBottom: 16 };

    return (
        <>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                Legal
            </p>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>GDPR Compliance</h1>
            <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 32 }}>Last updated: February 22, 2025</p>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", marginBottom: 32 }} />

            <p style={paraStyle}>
                HireHeaven is committed to complying with the General Data Protection Regulation (GDPR) and ensuring that
                all personal data is handled responsibly and transparently. This page outlines how we comply with GDPR
                requirements and your rights under the regulation.
            </p>

            <h2 style={headingStyle}>1. Data Controller</h2>
            <p style={paraStyle}>
                HireHeaven acts as the data controller for personal data collected through our platform. We determine the
                purposes and means of processing your personal data and are responsible for ensuring compliance with GDPR.
            </p>

            <h2 style={headingStyle}>2. Legal Basis for Processing</h2>
            <p style={paraStyle}>We process your personal data under the following legal bases:</p>
            <ul style={{ ...paraStyle, paddingLeft: 24 }}>
                <li style={{ marginBottom: 8 }}><strong>Consent:</strong> When you create an account and agree to our terms.</li>
                <li style={{ marginBottom: 8 }}><strong>Contract:</strong> To fulfill our obligations in providing job portal services.</li>
                <li style={{ marginBottom: 8 }}><strong>Legitimate Interest:</strong> To improve our services, prevent fraud, and ensure platform security.</li>
                <li style={{ marginBottom: 8 }}><strong>Legal Obligation:</strong> When required to comply with applicable laws.</li>
            </ul>

            <h2 style={headingStyle}>3. Your Rights Under GDPR</h2>
            <p style={paraStyle}>As an EU/EEA resident, you have the following rights:</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, marginBottom: 24 }}>
                {[
                    { title: "Right to Access", desc: "Request a copy of all personal data we hold about you." },
                    { title: "Right to Rectification", desc: "Request correction of inaccurate or incomplete personal data." },
                    { title: "Right to Erasure", desc: "Request deletion of your personal data (\"right to be forgotten\")." },
                    { title: "Right to Restrict Processing", desc: "Request limitation of how we process your data." },
                    { title: "Right to Data Portability", desc: "Receive your data in a structured, machine-readable format." },
                    { title: "Right to Object", desc: "Object to processing of your data for certain purposes." },
                ].map((right) => (
                    <div
                        key={right.title}
                        style={{
                            padding: 16,
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            background: "var(--muted)",
                        }}
                    >
                        <p style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)", marginBottom: 4 }}>{right.title}</p>
                        <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: "20px" }}>{right.desc}</p>
                    </div>
                ))}
            </div>

            <h2 style={headingStyle}>4. Data Processing Activities</h2>
            <p style={paraStyle}>We process personal data for the following purposes:</p>
            <ul style={{ ...paraStyle, paddingLeft: 24 }}>
                <li style={{ marginBottom: 8 }}>User account management and authentication.</li>
                <li style={{ marginBottom: 8 }}>Job matching and application processing.</li>
                <li style={{ marginBottom: 8 }}>Facilitating communication between recruiters and job seekers.</li>
                <li style={{ marginBottom: 8 }}>Platform analytics and service improvement.</li>
                <li style={{ marginBottom: 8 }}>Blog content management and delivery.</li>
                <li style={{ marginBottom: 8 }}>Payment and subscription management.</li>
            </ul>

            <h2 style={headingStyle}>5. Data Protection Measures</h2>
            <p style={paraStyle}>We implement the following technical and organizational measures:</p>
            <ul style={{ ...paraStyle, paddingLeft: 24 }}>
                <li style={{ marginBottom: 8 }}>Encryption of data in transit (HTTPS/TLS) and at rest.</li>
                <li style={{ marginBottom: 8 }}>Secure authentication using JWT tokens with expiration.</li>
                <li style={{ marginBottom: 8 }}>Role-based access control (RBAC) for data access.</li>
                <li style={{ marginBottom: 8 }}>Regular security assessments and vulnerability testing.</li>
                <li style={{ marginBottom: 8 }}>Data minimization — we only collect data necessary for our services.</li>
            </ul>

            <h2 style={headingStyle}>6. International Data Transfers</h2>
            <p style={paraStyle}>
                If your personal data is transferred outside the EU/EEA, we ensure appropriate safeguards are in place,
                such as Standard Contractual Clauses (SCCs) or adequacy decisions by the European Commission.
            </p>

            <h2 style={headingStyle}>7. Data Breach Notification</h2>
            <p style={paraStyle}>
                In the event of a personal data breach that is likely to result in a risk to your rights and freedoms,
                we will notify the relevant supervisory authority within 72 hours and inform affected users without undue delay.
            </p>

            <h2 style={headingStyle}>8. Data Protection Officer</h2>
            <p style={paraStyle}>
                For any GDPR-related inquiries, data access requests, or to exercise your rights, please contact our
                Data Protection Officer at{" "}
                <a href="mailto:dpo@hireheaven.com" style={{ color: "var(--primary)" }}>dpo@hireheaven.com</a>.
            </p>

            <h2 style={headingStyle}>9. Supervisory Authority</h2>
            <p style={paraStyle}>
                You have the right to lodge a complaint with a data protection supervisory authority in the EU member state
                of your habitual residence, place of work, or place of the alleged infringement.
            </p>
        </>
    );
}
