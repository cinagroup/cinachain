import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import styles from './index.module.css';

export default function Home() {
  return (
    <Layout title="CinaChain Docs" description="Architecture, deployment, and integration guides for CinaChain">
      <main className={styles.hero}>
        <div className="container">
          <h1 className={styles.title}>
            Cina<span>Chain</span> Docs
          </h1>
          <p className={styles.subtitle}>
            Architecture, deployment, and integration guides for the CinaChain ecosystem on Base.
          </p>
          <div className={styles.buttons}>
            <Link className={styles.primary} to="/docs/intro">Get Started</Link>
            <Link className={styles.secondary} to="/docs/architecture">Architecture</Link>
            <Link className={styles.secondary} href="https://nft.cinachain.com">Open DApp →</Link>
          </div>
        </div>
      </main>
    </Layout>
  );
}
