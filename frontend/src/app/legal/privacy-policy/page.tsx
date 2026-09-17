import React from "react";

export const metadata = {
    title: "Privacy Policy - HireHeaven",
    description: "HireHeaven Privacy Policy - How we collect, use, and protect your personal data.",
};

export default function PrivacyPolicyPage() {
    const headingStyle: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: "var(--foreground)", marginTop: 32, marginBottom: 12 };
    const paraStyle: React.CSSProperties = { fontSize: 15, lineHeight: "26px", color: "var(--muted-foreground)", marginBottom: 16 };

    return (
        <>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                Legal
            </p>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>Privacy Policy</h1>
            <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 32 }}>Last updated: February 22, 2025</p>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", marginBottom: 32 }} />

            <p style={paraStyle}>
                At HireHeaven, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose,
                and safeguard your information when you visit our platform and use our services.
            </p>

            <h2 style={headingStyle}>1. Information We Collect</h2>
            <p style={paraStyle}>We collect information that you provide directly to us, including:</p>
            <ul style={{ ...paraStyle, paddingLeft: 24 }}>
                <li style={{ marginBottom: 8 }}><strong>Account Information:</strong> Name, email address, password, phone number, and profile details.</li>
                <li style={{ marginBottom: 8 }}><strong>Profile Data:</strong> Resume, work experience, education, skills, and portfolio links.</li>
                <li style={{ marginBottom: 8 }}><strong>Company Data:</strong> Company name, description, logo, and recruiter information.</li>
                <li style={{ marginBottom: 8 }}><strong>Usage Data:</strong> Log data, device information, IP address, and browsing patterns.</li>
                <li style={{ marginBottom: 8 }}><strong>Communications:</strong> Messages sent through our chat system between recruiters and applicants.</li>
            </ul>

            <h2 style={headingStyle}>2. How We Use Your Information</h2>
            <p style={paraStyle}>We use the information we collect to:</p>
            <ul style={{ ...paraStyle, paddingLeft: 24 }}>
                <li style={{ marginBottom: 8 }}>Provide, maintain, and improve our job portal services.</li>
                <li style={{ marginBottom: 8 }}>Match job seekers with relevant job opportunities.</li>
                <li style={{ marginBottom: 8 }}>Facilitate communication between recruiters and applicants.</li>
                <li style={{ marginBottom: 8 }}>Send notifications about job applications, messages, and platform updates.</li>
                <li style={{ marginBottom: 8 }}>Analyze usage patterns to enhance user experience.</li>
                <li style={{ marginBottom: 8 }}>Prevent fraud and ensure platform security.</li>
            </ul>

            <h2 style={headingStyle}>3. Information Sharing</h2>
            <p style={paraStyle}>
                We do not sell your personal information. We may share your information in the following circumstances:
            </p>
            <ul style={{ ...paraStyle, paddingLeft: 24 }}>
                <li style={{ marginBottom: 8 }}><strong>With Recruiters:</strong> When you apply for a job, your profile information is shared with the recruiting company.</li>
                <li style={{ marginBottom: 8 }}><strong>With Job Seekers:</strong> Recruiters&apos; company information and job postings are visible to job seekers.</li>
                <li style={{ marginBottom: 8 }}><strong>Service Providers:</strong> We may share data with third-party services that help us operate our platform (e.g., cloud hosting, analytics).</li>
                <li style={{ marginBottom: 8 }}><strong>Legal Requirements:</strong> When required by law or to protect rights and safety.</li>
            </ul>

            <h2 style={headingStyle}>4. Data Security</h2>
            <p style={paraStyle}>
                We implement industry-standard security measures including encryption, secure authentication (JWT tokens),
                and regular security audits to protect your personal information. However, no method of transmission over
                the Internet is 100% secure.
            </p>

            <h2 style={headingStyle}>5. Data Retention</h2>
            <p style={paraStyle}>
                We retain your personal information for as long as your account is active or as needed to provide you services.
                You may request deletion of your account and associated data at any time by contacting us.
            </p>

            <h2 style={headingStyle}>6. Your Rights</h2>
            <p style={paraStyle}>You have the right to:</p>
            <ul style={{ ...paraStyle, paddingLeft: 24 }}>
                <li style={{ marginBottom: 8 }}>Access and receive a copy of your personal data.</li>
                <li style={{ marginBottom: 8 }}>Rectify inaccurate personal data.</li>
                <li style={{ marginBottom: 8 }}>Request deletion of your personal data.</li>
                <li style={{ marginBottom: 8 }}>Object to or restrict processing of your data.</li>
                <li style={{ marginBottom: 8 }}>Data portability — receive your data in a structured format.</li>
            </ul>

            <h2 style={headingStyle}>7. Contact Us</h2>
            <p style={paraStyle}>
                If you have questions about this Privacy Policy, please contact us at{" "}
                <a href="mailto:contact@hireheaven.com" style={{ color: "var(--primary)" }}>contact@hireheaven.com</a>.
            </p>
        </>
    );
}
