import React from "react";

export const metadata = {
    title: "Terms of Service - HireHeaven",
    description: "HireHeaven Terms of Service - Rules and guidelines for using our platform.",
};

export default function TermsOfServicePage() {
    const headingStyle: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: "var(--foreground)", marginTop: 32, marginBottom: 12 };
    const paraStyle: React.CSSProperties = { fontSize: 15, lineHeight: "26px", color: "var(--muted-foreground)", marginBottom: 16 };

    return (
        <>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                Legal
            </p>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>Terms of Service</h1>
            <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 32 }}>Last updated: February 22, 2025</p>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", marginBottom: 32 }} />

            <p style={paraStyle}>
                Welcome to HireHeaven. By accessing or using our platform, you agree to be bound by these Terms of Service.
                Please read them carefully before using our services.
            </p>

            <h2 style={headingStyle}>1. Acceptance of Terms</h2>
            <p style={paraStyle}>
                By creating an account or using HireHeaven, you acknowledge that you have read, understood, and agree to be
                bound by these terms. If you do not agree, you must not use our platform.
            </p>

            <h2 style={headingStyle}>2. User Accounts</h2>
            <p style={paraStyle}>To use our services, you must:</p>
            <ul style={{ ...paraStyle, paddingLeft: 24 }}>
                <li style={{ marginBottom: 8 }}>Be at least 18 years of age.</li>
                <li style={{ marginBottom: 8 }}>Provide accurate and complete registration information.</li>
                <li style={{ marginBottom: 8 }}>Maintain the security of your account credentials.</li>
                <li style={{ marginBottom: 8 }}>Notify us immediately of any unauthorized access to your account.</li>
            </ul>

            <h2 style={headingStyle}>3. Job Seekers</h2>
            <p style={paraStyle}>As a job seeker on HireHeaven, you agree to:</p>
            <ul style={{ ...paraStyle, paddingLeft: 24 }}>
                <li style={{ marginBottom: 8 }}>Provide truthful and accurate information in your profile, resume, and applications.</li>
                <li style={{ marginBottom: 8 }}>Not misrepresent your qualifications, experience, or skills.</li>
                <li style={{ marginBottom: 8 }}>Use the platform solely for legitimate job-seeking purposes.</li>
                <li style={{ marginBottom: 8 }}>Respect the confidentiality of communications with recruiters.</li>
            </ul>

            <h2 style={headingStyle}>4. Recruiters & Employers</h2>
            <p style={paraStyle}>As a recruiter or employer on HireHeaven, you agree to:</p>
            <ul style={{ ...paraStyle, paddingLeft: 24 }}>
                <li style={{ marginBottom: 8 }}>Post only genuine job opportunities with accurate descriptions.</li>
                <li style={{ marginBottom: 8 }}>Not use applicant data for purposes other than recruitment.</li>
                <li style={{ marginBottom: 8 }}>Comply with all applicable employment and anti-discrimination laws.</li>
                <li style={{ marginBottom: 8 }}>Respond to applicants in a timely and professional manner.</li>
                <li style={{ marginBottom: 8 }}>Maintain accurate company information and job listings.</li>
            </ul>

            <h2 style={headingStyle}>5. Prohibited Conduct</h2>
            <p style={paraStyle}>Users must not:</p>
            <ul style={{ ...paraStyle, paddingLeft: 24 }}>
                <li style={{ marginBottom: 8 }}>Post fraudulent, misleading, or discriminatory job listings.</li>
                <li style={{ marginBottom: 8 }}>Harass, spam, or send unsolicited messages to other users.</li>
                <li style={{ marginBottom: 8 }}>Scrape, crawl, or use automated means to access the platform.</li>
                <li style={{ marginBottom: 8 }}>Attempt to gain unauthorized access to other user accounts or system resources.</li>
                <li style={{ marginBottom: 8 }}>Upload malicious content, viruses, or harmful code.</li>
                <li style={{ marginBottom: 8 }}>Violate any applicable local, state, national, or international law.</li>
            </ul>

            <h2 style={headingStyle}>6. Content & Intellectual Property</h2>
            <p style={paraStyle}>
                You retain ownership of content you post on HireHeaven. By posting content, you grant us a non-exclusive,
                worldwide license to use, display, and distribute your content in connection with operating the platform.
                All HireHeaven branding, logos, and platform design are our intellectual property.
            </p>

            <h2 style={headingStyle}>7. Subscription & Payments</h2>
            <p style={paraStyle}>
                Certain premium features may require a paid subscription. Subscription fees are billed in advance and are
                non-refundable unless otherwise stated. We reserve the right to modify pricing with prior notice.
            </p>

            <h2 style={headingStyle}>8. Limitation of Liability</h2>
            <p style={paraStyle}>
                HireHeaven is provided &quot;as is&quot; without warranties of any kind. We do not guarantee employment outcomes,
                the accuracy of job listings, or the conduct of other users. We shall not be liable for any indirect,
                incidental, or consequential damages arising from your use of the platform.
            </p>

            <h2 style={headingStyle}>9. Termination</h2>
            <p style={paraStyle}>
                We may suspend or terminate your account if you violate these terms. You may also delete your account at
                any time. Upon termination, your right to use the platform ceases immediately.
            </p>

            <h2 style={headingStyle}>10. Changes to Terms</h2>
            <p style={paraStyle}>
                We may update these Terms of Service from time to time. We will notify users of significant changes via
                email or platform notification. Continued use of the platform after changes constitutes acceptance.
            </p>

            <h2 style={headingStyle}>11. Contact Us</h2>
            <p style={paraStyle}>
                For questions about these Terms of Service, contact us at{" "}
                <a href="mailto:contact@hireheaven.com" style={{ color: "var(--primary)" }}>contact@hireheaven.com</a>.
            </p>
        </>
    );
}
